import { invoke } from '@tauri-apps/api/tauri';
import { emit, listen } from '@tauri-apps/api/event';

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  connected_at: string;
}

export interface PluginMessage {
  plugin_id: string;
  message_type: string;
  data: any;
}

export class PluginAPIServer {
  private static instance: PluginAPIServer | null = null;
  private isInitialized = false;
  private serverPort = 3003;

  private constructor() {
    this.setupEventHandlers();
  }

  public static getInstance(): PluginAPIServer {
    if (!PluginAPIServer.instance) {
      PluginAPIServer.instance = new PluginAPIServer();
    }
    return PluginAPIServer.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('Initializing Plugin API Server...');
    
    try {
      // Start the Rust WebSocket server
      await invoke('start_plugin_server', { port: this.serverPort });
      console.log('Plugin API Server started on port', this.serverPort);
      
      // Setup event listeners for plugin events
      await this.setupTauriEventListeners();
      
      this.isInitialized = true;
      console.log(`Plugin API Server initialized on port ${this.serverPort}`);
    } catch (error) {
      console.error('Failed to initialize Plugin API Server:', error);
      throw error;
    }
  }

  setupEventHandlers() {
    // TODO: Implement event handlers
  }

  setupTauriEventListeners() {
    // TODO: Implement event listeners
  }
}

// Export the singleton instance
export const pluginAPIServer = PluginAPIServer.getInstance(); 