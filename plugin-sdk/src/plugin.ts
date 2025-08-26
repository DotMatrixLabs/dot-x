// dot-x-plugin/src/plugin.ts
import { APIClient, PluginInfo, ConnectionConfig } from './client';
import type { PluginAPI } from './types';
import { SettingsBuilder } from './ui';
import type { SettingsSections } from './types';
import * as fs from 'fs';
import * as path from 'path';
import Conf from 'conf';


class Plugin {
  // public settings: PluginAPI['settings'];
  public ui: PluginAPI['ui'];
  public config: PluginAPI['config'];
  private client: APIClient;
  private configStore?: Conf<Record<string, any>>;
  
  constructor(pluginInfo: PluginInfo, config?: ConnectionConfig) {
    this.client = new APIClient(pluginInfo, config);
    // this.settings = this.client.settings;
    this.ui = this.client.ui as any;

    // Initialize local config store in the same folder as the plugin's entry (main.js)
    const entryDir = process.cwd();
    const configName = `${pluginInfo.id || 'plugin'}-config`;
    this.configStore = new Conf<Record<string, any>>({
      cwd: entryDir,
      configName,
      fileExtension: 'json',
    });

    this.config = {
      set: (keyOrObject: string | Record<string, any>, value?: any) => {
        if (typeof keyOrObject === 'object' && keyOrObject !== null) {
          this.configStore!.set(keyOrObject as Record<string, any>);
          return;
        }
        this.configStore!.set(keyOrObject as string, value);
      },
      get: <T = any>(key: string, defaultValue?: T) => {
        return this.configStore!.get(key, defaultValue as any) as T | undefined;
      },
      delete: (key: string) => {
        this.configStore!.delete(key);
      },
      clear: () => {
        this.configStore!.clear();
      },
      has: (key: string) => {
        return this.configStore!.has(key);
      },
      all: () => {
        return { ...(this.configStore as Conf<Record<string, any>>).store };
      },
      path: () => {
        return (this.configStore as Conf<Record<string, any>>).path;
      },
      init: (options?: { schema?: Record<string, any>; defaults?: Record<string, any> }) => {
        const entryDirLocal = process.cwd();
        const configNameLocal = `${pluginInfo.id || 'plugin'}-config`;
        this.configStore = new Conf<Record<string, any>>({
          cwd: entryDirLocal,
          configName: configNameLocal,
          fileExtension: 'json',
          schema: options?.schema as any,
          defaults: options?.defaults as any,
        });
      }
    };
  }
  
  // Get the underlying client for accessing connection methods
  getClient(): APIClient {
    return this.client;
  }
  
  // Wait for connection to be established
  waitForConnection(): Promise<void> {
    return this.client.waitForConnection();
  }

  // Convenience: build and register settings in one go
  async createSettingsPage(buildFn: (builder: SettingsBuilder) => void): Promise<void> {
    // Build once, persist schema for get_plugin_settings
    const builder = new SettingsBuilder(() => {
      // On any mutation from field handles, push the latest schema
      const updated = builder.build();
      this.client.setSectionedSchema(updated);
      // Notify host to refresh UI
      this.client.notifySettingsUpdated();
    });
    buildFn(builder);
    const sectioned = builder.build();
    this.client.setSectionedSchema(sectioned);
    // Enable notifications for subsequent handle updates only (not initial setup)
    builder.enableNotifications();
  }

  // Expose sectioned UI for get_plugin_settings or other consumers if desired
  buildSettingsSchema(buildFn: (builder: SettingsBuilder) => void): SettingsSections {
    const builder = new SettingsBuilder();
    buildFn(builder);
    return builder.build();
  }
 
  
  // Get connection status
  getConnectionStatus(): string {
    return this.client.getConnectionStatus();
  }
  
  // Check if connected
  isConnected(): boolean {
    return this.client.isConnected();
  }
  
  // Plugin lifecycle methods
  async onLoad() {
    console.log("Plugin loaded");
  }
  async onUnload() {
    console.log("Plugin unloaded");
    this.client.disconnect();
  }
}

/**
 * Reads the manifest.json file from the current working directory
 */
function readManifest() {
  try {
    const manifestPath = path.join(process.cwd(), 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      return JSON.parse(manifestContent);
    }
  } catch (error) {
    console.warn('Failed to read manifest.json:', error);
  }
  return null;
}

/**
 * Automatically runs a plugin when the module is executed directly
 * Use this at the end of your plugin file like:
 * 
 * if (require.main === module) {
 *   runPlugin(YourPluginClass);
 * }
 * 
 * @param PluginClass The plugin class to instantiate and run
 * @param config Optional connection configuration
 */
export async function runPlugin(PluginClass: typeof Plugin, config?: ConnectionConfig) {
  const manifest = readManifest();
  const pluginName = manifest?.name || PluginClass.name || 'Unknown Plugin';
  const version = manifest?.version || '1.0.0';
  const pluginId = manifest?.id || pluginName.toLowerCase().replace(/\s+/g, '-');
  
  console.log(`Starting ${pluginName} v${version}...`);
  if (manifest?.description) {
    console.log(`Description: ${manifest.description}`);
  }
  if (manifest?.author) {
    console.log(`Author: ${manifest.author}`);
  }
  
  // Create plugin info for registration
  const pluginInfo: PluginInfo = {
    id: pluginId,
    name: pluginName,
    version: version,
    connected_at: new Date().toISOString()
  };
  
  let plugin: Plugin;
  let isShuttingDown = false;
  
  try {
    plugin = new PluginClass(pluginInfo, config);
    
    // Wait for connection to be established
    console.log('Waiting for connection to be established...');
    await plugin.waitForConnection();
    
    console.log('Connection established, calling onLoad...');
    await plugin.onLoad();
    console.log(`${pluginName} loaded successfully!`);
    
  } catch (error) {
    console.error(`Failed to start ${pluginName}:`, error.message);
    process.exit(1);
  }
  
  // Handle graceful shutdown
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log(`\nShutting down ${pluginName}...`);
    try {
      await plugin.onUnload();
      console.log("Plugin unloaded successfully.");
    } catch (error) {
      console.error("Error during plugin unload:", error);
    }
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  
}



export default Plugin;