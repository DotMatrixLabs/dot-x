import { invoke } from '@tauri-apps/api/tauri';
import { Store } from 'tauri-plugin-store-api';
import { useToast } from 'vue-toastification';
import { PluginRPCServer } from '../rpc/plugin-rpc-server';

const toast = useToast();

export interface PluginConfig {
  id: string;
  enabled: boolean;
  folder_path: string;
  auto_start: boolean;
  last_modified?: string;
}

export interface PluginProcess {
  id: string;
  pid: number;
  started_at: string;
  permissions: string[];
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  permissions: string[];
  dotxVersion?: string;
  license?: string;
  keywords?: string[];
  homepage?: string;
  repository?: string;
  engines?: Record<string, string>;
}

class PluginManager {
  private store: Store;
  private plugins: Map<string, PluginConfig> = new Map();
  private loadedPlugins: Map<string, PluginProcess> = new Map();
  private rpcServer: PluginRPCServer;

  constructor() {
    this.store = new Store('plugins.json');
    this.rpcServer = new PluginRPCServer();
  }

  /**
   * Initialize the plugin manager and load plugin configurations
   */
  async initialize(): Promise<void> {
    try {
      // Start the RPC server
      await this.rpcServer.start();
      console.log('Plugin RPC server started');
      
      await this.loadPluginConfigs();
      await this.discoverNewPlugins();
      await this.startAutoStartPlugins();
    } catch (error) {
      console.error('Failed to initialize plugin manager:', error);
      toast.error('Failed to initialize plugin system');
    }
  }

  /**
   * Load plugin configurations from the store
   */
  private async loadPluginConfigs(): Promise<void> {
    try {
      const configs = await this.store.get('pluginConfigs') as PluginConfig[] || [];
      this.plugins.clear();
      
      for (const config of configs) {
        this.plugins.set(config.id, config);
      }
      
      console.log(`Loaded ${configs.length} plugin configurations`);
    } catch (error) {
      console.error('Failed to load plugin configurations:', error);
    }
  }

  /**
   * Save plugin configurations to the store
   */
  private async savePluginConfigs(): Promise<void> {
    try {
      const configs = Array.from(this.plugins.values());
      await this.store.set('pluginConfigs', configs);
      await this.store.save();
    } catch (error) {
      console.error('Failed to save plugin configurations:', error);
    }
  }

  /**
   * Discover new plugins from the plugins directory
   */
  async discoverNewPlugins(): Promise<void> {
    try {
      const discoveredPlugins = await invoke<PluginConfig[]>('discover_plugins');
      let newPluginsFound = false;

      for (const plugin of discoveredPlugins) {
        if (!this.plugins.has(plugin.id)) {
          this.plugins.set(plugin.id, plugin);
          newPluginsFound = true;
          console.log(`Discovered new plugin: ${plugin.id}`);
        }
      }

      if (newPluginsFound) {
        await this.savePluginConfigs();
        toast.info('New plugins discovered! Check the settings to enable them.');
      }
    } catch (error) {
      console.error('Failed to discover plugins:', error);
      toast.error('Failed to discover plugins');
    }
  }

  /**
   * Start all plugins that are enabled and set to auto-start
   */
  async startAutoStartPlugins(): Promise<void> {
    const autoStartPlugins = Array.from(this.plugins.values())
      .filter(plugin => plugin.enabled && plugin.auto_start);

    if (autoStartPlugins.length === 0) {
      console.log('No auto-start plugins found');
      return;
    }

    try {
      console.log(`Starting ${autoStartPlugins.length} auto-start plugins...`);
      const startedPlugins = await invoke<string[]>('start_plugins', {
        pluginConfigs: autoStartPlugins
      });

      for (const pluginId of startedPlugins) {
        console.log(`Successfully started plugin: ${pluginId}`);
      }

      await this.refreshActivePlugins();
      
      if (startedPlugins.length > 0) {
        toast.success(`Started ${startedPlugins.length} plugin(s)`);
      }
    } catch (error) {
      console.error('Failed to start auto-start plugins:', error);
      toast.error('Failed to start some plugins');
    }
  }

  /**
   * Start a specific plugin
   */
  async startPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      toast.error(`Plugin ${pluginId} not found`);
      return false;
    }

    if (!plugin.enabled) {
      toast.error(`Plugin ${pluginId} is not enabled`);
      return false;
    }

    try {
      const startedPlugins = await invoke<string[]>('start_plugins', {
        pluginConfigs: [plugin]
      });

      if (startedPlugins.includes(pluginId)) {
        await this.refreshActivePlugins();
        toast.success(`Started plugin: ${pluginId}`);
        return true;
      } else {
        toast.error(`Failed to start plugin: ${pluginId}`);
        return false;
      }
    } catch (error) {
      console.error(`Failed to start plugin ${pluginId}:`, error);
      toast.error(`Failed to start plugin: ${pluginId}`);
      return false;
    }
  }

  /**
   * Stop a specific plugin
   */
  async stopPlugin(pluginId: string): Promise<boolean> {
    try {
      await invoke('stop_plugin', { pluginId });
      await this.refreshActivePlugins();
      toast.success(`Stopped plugin: ${pluginId}`);
      return true;
    } catch (error) {
      console.error(`Failed to stop plugin ${pluginId}:`, error);
      toast.error(`Failed to stop plugin: ${pluginId}`);
      return false;
    }
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.enabled = true;
      await this.savePluginConfigs();
      toast.success(`Enabled plugin: ${pluginId}`);
    }
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.enabled = false;
      // Also stop the plugin if it's running
      if (this.loadedPlugins.has(pluginId)) {
        await this.stopPlugin(pluginId);
      }
      await this.savePluginConfigs();
      toast.success(`Disabled plugin: ${pluginId}`);
    }
  }

  /**
   * Set auto-start for a plugin
   */
  async setAutoStart(pluginId: string, autoStart: boolean): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.auto_start = autoStart;
      await this.savePluginConfigs();
      console.log(`Set auto-start for ${pluginId}: ${autoStart}`);
    }
  }

  /**
   * Refresh the list of active plugins
   */
  async refreshActivePlugins(): Promise<void> {
    try {
      const activePlugins = await invoke<PluginProcess[]>('get_active_plugins');
      this.loadedPlugins.clear();
      
      for (const plugin of activePlugins) {
        this.loadedPlugins.set(plugin.id, plugin);
      }
    } catch (error) {
      console.error('Failed to refresh active plugins:', error);
    }
  }

  /**
   * Get all plugin configurations
   */
  getPluginConfigs(): PluginConfig[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get all active plugins
   */
  getActivePlugins(): PluginProcess[] {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * Check if a plugin is running
   */
  isPluginRunning(pluginId: string): boolean {
    return this.loadedPlugins.has(pluginId);
  }

  /**
   * Get a specific plugin configuration
   */
  getPluginConfig(pluginId: string): PluginConfig | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get plugin statistics
   */
  getStats() {
    return {
      total: this.plugins.size,
      enabled: Array.from(this.plugins.values()).filter(p => p.enabled).length,
      running: this.loadedPlugins.size,
      autoStart: Array.from(this.plugins.values()).filter(p => p.auto_start).length
    };
  }
}

// Export singleton instance
export default new PluginManager(); 