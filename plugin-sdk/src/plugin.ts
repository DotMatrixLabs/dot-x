// dot-x-plugin/src/plugin.ts
import { APIClient, PluginInfo, ConnectionConfig, DeviceChanges } from './client';
import type { PluginAPI } from './types';
import { SettingsBuilder, ActionMapper } from './ui';
import type { SettingsSections } from './types';
import { createDeviceAPI, type DeviceAPI } from './device';
import * as fs from 'fs';
import * as path from 'path';
import Conf from 'conf';

/**
 * Base class for creating Dot X plugins.
 * 
 * Extend this class to create your own plugin. Override lifecycle methods like
 * `onLoad()` and `onUnload()` to implement your plugin's behavior.
 * 
 * Use `this.device.onUpdate()` to respond to device value changes.
 * 
 * @category Plugin Lifecycle
 * 
 * @example
 * ```typescript
 * import Plugin, { runPlugin } from 'dotx-plugin-sdk';
 * 
 * export default class MyPlugin extends Plugin {
 *   async onLoad() {
 *     console.log('Plugin loaded!');
 *     
 *     // Create settings UI
 *     await this.createSettingsPage((settings) => {
 *       settings.addSection('general');
 *       settings.addInput('apiKey')
 *         .setLabel('API Key')
 *         .setType('password')
 *         .setValue(this.config.get('apiKey', ''));
 *     });
 *     
 *     // Monitor device connections
 *     this.device.onConnect((device) => {
 *       console.log('Device connected:', device.name);
 *     });
 *     
 *     // Monitor device updates
 *     this.device.onUpdate((data) => {
 *       console.log('Device values updated:', data.changes);
 *     });
 *     
 *     // Show notification
 *     await this.ui.showToast({
 *       message: 'Plugin loaded successfully!',
 *       type: 'success'
 *     });
 *   }
 *   
 *   async onUnload() {
 *     console.log('Plugin unloading...');
 *   }
 * }
 * 
 * if (require.main === module) {
 *   runPlugin(MyPlugin);
 * }
 * ```
 */
class Plugin {
  /**
   * Global UI methods for showing toasts, modals, and confirmations.
   * 
   * @example
   * ```typescript
   * // Show a success toast
   * await this.ui.showToast({
   *   message: 'Operation completed!',
   *   type: 'success',
   *   duration: 3000
   * });
   * ```
   */
  public ui: PluginAPI['ui'];
  
  /**
   * Device management API for monitoring connections and updates.
   * 
   * @example
   * ```typescript
   * // Check connected devices
   * const devices = await this.device.getConnected();
   * console.log('Connected:', devices);
   * 
   * // Listen for device connections
   * this.device.onConnect((device) => {
   *   console.log('Device connected:', device.name);
   * });
   * 
   * // Listen for value updates
   * this.device.onUpdate((data) => {
   *   console.log('Values changed:', data.changes);
   * });
   * 
   * // Control RGB lighting
   * await this.device.rgb.setEffect('rainbow', 75, 100, '#FFFFFF');
   * ```
   */
  public device: DeviceAPI;
  
  /**
   * Action mapper for creating System Utilities buttons.
   * 
   * 
   * @example
   * ```typescript
   * this.actionmapper
   *   .addSystemUtilButton('myAction')
   *   .setTitle('My Action')
   *   .setIcon('fas fa-bolt fa-lg')
   *   .onClick(({ selected, channel }) => {
   *     console.log(`Action ${selected ? 'enabled' : 'disabled'} on channel ${channel}`);
   *   });
   * ```
   */
  public actionmapper: any;
  
  /**
   * Settings page builder for creating plugin settings UI.
   * 
   * 
   * @example
   * ```typescript
   * await this.settingsPage.addSettings((settings) => {
   *   settings.addSection('general')
   *     .setName('General Settings');
   *   
   *   settings.addInput('apiKey')
   *     .setLabel('API Key')
   *     .setType('password')
   *     .setValue(this.config.get('apiKey', ''))
   *     .onChange(({ value }) => {
   *       this.config.set('apiKey', value);
   *     });
   * });
   * ```
   */
  public settingsPage: any;
  
  /**
   * Local persistent configuration storage.
   * 
   * Store and retrieve plugin configuration data that persists across restarts.
   * 
   * 
   * @example
   * ```typescript
   * // Initialize config with schema
   * this.config.init({
   *   schema: {
   *     settings: {
   *       type: 'object',
   *       properties: {
   *         apiKey: { type: 'string', default: '' }
   *       }
   *     }
   *   }
   * });
   * 
   * // Set a value
   * this.config.set('settings.apiKey', 'my-key');
   * 
   * // Get a value
   * const apiKey = this.config.get('settings.apiKey', 'default-key');
   * 
   * // Check if key exists
   * if (this.config.has('settings.apiKey')) {
   *   console.log('API key is configured');
   * }
   * ```
   */
  public config: PluginAPI['config'];
  
  private client: APIClient;
  private configStore?: Conf<Record<string, any>>;
  
  constructor(pluginInfo: PluginInfo, config?: ConnectionConfig) {
    this.client = new APIClient(pluginInfo, config);
    // this.settings = this.client.settings;
    this.ui = this.client.ui as any;
    this.device = this.client.device;

    // Initialize local config store in the same folder as the plugin entry file.
    const entryDir = process.cwd();
    const configName = `${pluginInfo.id || 'plugin'}-config`;
    this.configStore = new Conf<Record<string, any>>({
      cwd: entryDir,
      configName,
      fileExtension: 'json',
    });

    this.config = {
      /**
       * Sets a configuration value.
       * 
       * Supports dot notation for nested keys (e.g., 'settings.apiKey').
       * Can also accept an object to set multiple values at once.
       * 
       * @category Storing Data
       * 
       * @param keyOrObject - Key string or object with multiple key-value pairs
       * @param value - Value to set (when first param is a string)
       * 
       * @example
       * ```typescript
       * // Set a simple value
       * this.config.set('apiKey', 'my-secret-key');
       * 
       * // Set nested value using dot notation
       * this.config.set('settings.broker.ip', '192.168.1.1');
       * this.config.set('settings.broker.port', 1883);
       * 
       * // Set multiple values at once
       * this.config.set({
       *   apiKey: 'my-secret-key',
       *   'settings.broker.ip': '192.168.1.1',
       *   'settings.broker.port': 1883
       * });
       * ```
       */
      set: (keyOrObject: string | Record<string, any>, value?: any) => {
        if (typeof keyOrObject === 'object' && keyOrObject !== null) {
          this.configStore!.set(keyOrObject as Record<string, any>);
          return;
        }
        this.configStore!.set(keyOrObject as string, value);
      },
      /**
       * Gets a configuration value.
       * 
       * Supports dot notation for nested keys. Returns the default value if key doesn't exist.
       * 
       * @category Storing Data
       * 
       * @param key - Configuration key (supports dot notation)
       * @param defaultValue - Default value if key doesn't exist
       * @returns The stored value or default value
       * 
       * @example
       * ```typescript
       * // Get a simple value
       * const apiKey = this.config.get('apiKey', 'default-key');
       * 
       * // Get nested value using dot notation
       * const brokerIP = this.config.get('settings.broker.ip', '127.0.0.1');
       * 
       * // Type-safe retrieval
       * const port = this.config.get<number>('settings.broker.port', 1883);
       * const debug = this.config.get<boolean>('debug', false);
       * ```
       */
      get: <T = any>(key: string, defaultValue?: T) => {
        return this.configStore!.get(key, defaultValue as any) as T | undefined;
      },
      /**
       * Deletes a configuration value.
       * 
       * @category Storing Data
       * 
       * @param key - Configuration key to delete
       * 
       * @example
       * ```typescript
       * // Delete a value
       * this.config.delete('apiKey');
       * 
       * // Delete nested value
       * this.config.delete('settings.broker.ip');
       * ```
       */
      delete: (key: string) => {
        this.configStore!.delete(key);
      },
      /**
       * Clears all configuration data.
       * 
       * @category Storing Data
       * 
       * @example
       * ```typescript
       * // Reset all settings
       * this.config.clear();
       * ```
       */
      clear: () => {
        this.configStore!.clear();
      },
      /**
       * Checks if a configuration key exists.
       * 
       * @category Storing Data
       * 
       * @param key - Configuration key to check
       * @returns True if key exists, false otherwise
       * 
       * @example
       * ```typescript
       * if (this.config.has('apiKey')) {
       *   console.log('API key is configured');
       * } else {
       *   console.log('API key not set');
       * }
       * 
       * // Check nested key
       * if (this.config.has('settings.broker.ip')) {
       *   console.log('Broker IP is configured');
       * }
       * ```
       */
      has: (key: string) => {
        return this.configStore!.has(key);
      },
      /**
       * Gets all configuration data as an object.
       * 
       * @category Storing Data
       * 
       * @returns Object containing all configuration data
       * 
       * @example
       * ```typescript
       * // Get all config
       * const allConfig = this.config.all();
       * console.log('All settings:', allConfig);
       * 
       * // Export config
       * const configJson = JSON.stringify(this.config.all(), null, 2);
       * ```
       */
      all: () => {
        return { ...(this.configStore as Conf<Record<string, any>>).store };
      },
      /**
       * Gets the file path where configuration is stored.
       * 
       * @category Storing Data
       * 
       * @returns Absolute path to the config file
       * 
       * @example
       * ```typescript
       * console.log('Config stored at:', this.config.path());
       * // Output: Config stored at: /path/to/plugin/my-plugin-config.json
       * ```
       */
      path: () => {
        return (this.configStore as Conf<Record<string, any>>).path;
      },
      /**
       * Initializes or reinitializes the configuration store with schema and defaults.
       * 
       * @category Storing Data
       * 
       * @param options - Initialization options
       * @param options.schema - JSON schema for validation
       * @param options.defaults - Default values
       * 
       * @example
       * ```typescript
       * // Initialize with schema and defaults
       * this.config.init({
       *   schema: {
       *     settings: {
       *       type: 'object',
       *       properties: {
       *         apiKey: {
       *           type: 'string',
       *           default: ''
       *         },
       *         broker: {
       *           type: 'object',
       *           properties: {
       *             ip: { type: 'string', default: '127.0.0.1' },
       *             port: { type: 'number', default: 1883 }
       *           }
       *         }
       *       }
       *     }
       *   },
       *   defaults: {
       *     settings: {
       *       apiKey: '',
       *       broker: {
       *         ip: '127.0.0.1',
       *         port: 1883
       *       }
       *     }
       *   }
       * });
       * ```
       */
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

    // SliderAction builder property behaving like a live builder
    const actionMapperBuilder = new ActionMapper(() => {
      const updated = actionMapperBuilder.build();
      this.client.setActionMappings(updated);
      this.client.notifyActionsUpdated();
    }, this.config);
    // Enable live notifications so subsequent mutations push updates
    actionMapperBuilder.enableNotifications();
    this.actionmapper = actionMapperBuilder;

    this.settingsPage = {

      /**
       * Adds settings to the plugin settings page.
       * 
       * @category Settings Page
       * @see SettingsBuilder Components - For all available UI components
       * 
       * @param buildFn - The function to build the settings.
       * @returns The settings page builder.
       * @order first
       * 
       * @example
       * ```typescript
       * this.settingsPage.addSettings((settings) => {
       *   settings.addSection('general');
       *   settings.addInput('apiKey')
       *     .setLabel('API Key')
       *     .setType('password')
       *     .setValue(this.config.get('apiKey', ''));
       * });
       * ```
       */
      addSettings: async (buildFn: (builder: SettingsBuilder) => void): Promise<void> => {
        const builder = new SettingsBuilder(() => {
          const updated = builder.build();
          this.client.setSectionedSchema(updated);
          this.client.notifySettingsUpdated();
        });
        buildFn(builder);
        const sectioned = builder.build();
        this.client.setSectionedSchema(sectioned);
        builder.enableNotifications();
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


  // Expose sectioned UI for get_plugin_settings or other consumers if desired
  buildSettingsSchema(buildFn: (builder: SettingsBuilder) => void): SettingsSections {
    const builder = new SettingsBuilder();
    buildFn(builder);
    return builder.build();
  }
 
  /**
   * Gets the connection status of the plugin.
   * 
   * @returns The connection status of the plugin
   * 
   * @example
   * ```typescript
   * const connectionStatus = this.getConnectionStatus();
   * console.log('Connection status:', connectionStatus);
   * ```
   */
  getConnectionStatus(): string {
    return this.client.getConnectionStatus();
  }
  
  /**
   * Checks if the plugin is connected to the host.
   * 
   * @returns True if the plugin is connected, false otherwise
   * 
   * @example
   * ```typescript
   * const isConnected = this.isConnected();
   * console.log('Is connected:', isConnected);
   * ```
   */
  isConnected(): boolean {
    return this.client.isConnected();
  }
  
  /**
   * Called when the plugin is loaded and ready to run.
   * 
   * Override this method to initialize your plugin, create settings UI,
   * register action buttons, and set up any necessary resources.
   * 
   * @category Plugin Lifecycle
   * 
   * @example
   * ```typescript
   * async onLoad() {
   *   console.log('My plugin is loading...');
   *   
   *   // Initialize configuration
   *   this.config.init({
   *     schema: {
   *       settings: {
   *         type: 'object',
   *         properties: {
   *           apiKey: { type: 'string', default: '' }
   *         }
   *       }
   *     }
   *   });
   *   
   *   // Create settings UI
   *   await this.createSettingsPage((settings) => {
   *     settings.addSection('general');
   *     settings.addInput('apiKey')
   *       .setLabel('API Key')
   *       .setType('password');
   *   });
   *   
   *   // Add action button
   *   this.actionmapper
   *     .addSystemUtilButton('myAction')
   *     .setTitle('My Action')
   *     .onClick(({ selected, channel }) => {
   *       console.log(`Action triggered on channel ${channel}`);
   *     });
   *   
   *   console.log('Plugin loaded successfully!');
   * }
   * ```
   */
  async onLoad() {
    console.log("Plugin loaded");
  }

  /**
   * Called when the plugin is being unloaded or the application is shutting down.
   * 
   * Override this method to perform cleanup tasks like closing connections,
   * saving state, or releasing resources.
   * 
   * @category Plugin Lifecycle
   * 
   * @example
   * ```typescript
   * async onUnload() {
   *   console.log('Cleaning up plugin resources...');
   *   
   *   // Save any pending data
   *   this.config.set('lastShutdown', new Date().toISOString());
   *   
   *   // Close connections
   *   if (this.mqttClient) {
   *     await this.mqttClient.end();
   *   }
   *   
   *   console.log('Plugin unloaded successfully');
   * }
   * ```
   */
  async onUnload() {
    console.log("Plugin unloaded");
    this.client.disconnect();
  }
}

/**
 * Reads the manifest.json file from the current working directory.
 * 
 * @internal
 * @category Advanced/Internal
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
 * Automatically runs a plugin when the module is executed directly.
 * 
 * This utility function handles the complete plugin lifecycle:
 * - Reads plugin metadata from manifest.json
 * - Establishes connection to the Dot X application
 * - Waits for successful registration
 * - Calls the plugin's onLoad() method
 * - Handles graceful shutdown on SIGINT/SIGTERM
 * - Provides automatic retry logic for connection failures
 * 
 * @category Plugin Lifecycle
 * 
 * @param PluginClass - The plugin class to instantiate and run
 * @param config - Optional connection configuration to customize behavior
 * 
 * @example
 * ```typescript
 * import Plugin, { runPlugin } from 'dotx-plugin-sdk';
 * 
 * export default class MyPlugin extends Plugin {
 *   async onLoad() {
 *     console.log('Plugin loaded!');
 *   }
 * }
 * 
 * // Run the plugin when executed directly
 * if (require.main === module) {
 *   runPlugin(MyPlugin);
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // With custom connection configuration
 * import Plugin, { runPlugin, ConnectionConfig } from 'dotx-plugin-sdk';
 * 
 * const config: ConnectionConfig = {
 *   serverUrl: 'http://localhost:3001',
 *   maxRetries: 10,
 *   retryDelay: 3000,
 *   connectionTimeout: 15000
 * };
 * 
 * if (require.main === module) {
 *   runPlugin(MyPlugin, config);
 * }
 * ```
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
    console.error(`Failed to start ${pluginName}:`, (error as Error).message);
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
