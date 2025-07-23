// dot-x-plugin/src/plugin.ts
import { APIClient, PluginInfo } from './client';
import type { PluginAPI } from './generated/types';
import * as fs from 'fs';
import * as path from 'path';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  dotxVersion?: string;
  main: string;
}

export default class Plugin {
  public settings: PluginAPI['settings'];
  public ui: PluginAPI['ui'];
  private client: APIClient;
  
  constructor(pluginInfo: PluginInfo) {
    this.client = new APIClient(pluginInfo);
    this.settings = this.client.settings;
    this.ui = this.client.ui;
  }
  
  // Wait for the plugin to be registered with the server
  async waitForConnection(): Promise<void> {
    await this.client.waitForRegistration();
  }
  
  // Plugin lifecycle methods
  async onLoad() {}
  async onUnload() {
    this.client.disconnect();
  }
}

/**
 * Reads the manifest.json file from the current working directory
 */
function readManifest(): PluginManifest | null {
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
 */
export async function runPlugin(PluginClass: typeof Plugin) {
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
  
  const plugin = new PluginClass(pluginInfo);
  
  try {
    console.log("Waiting for connection to plugin server...");
    await plugin.waitForConnection();
    console.log("Connected to plugin server, initializing plugin...");
    
    await plugin.onLoad();
    console.log("Plugin loaded successfully!");
  } catch (error) {
    console.error("Failed to load plugin:", error);
    process.exit(1);
  }
  
  // Keep the process running to maintain WebSocket connection
  console.log("Plugin is running. Press Ctrl+C to exit.");
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log(`\nShutting down ${pluginName}...`);
    try {
      await plugin.onUnload();
      console.log("Plugin unloaded successfully.");
    } catch (error) {
      console.error("Error during plugin unload:", error);
    }
    process.exit(0);
  });
}