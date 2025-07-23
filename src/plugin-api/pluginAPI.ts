import { invoke } from '@tauri-apps/api/tauri';
import { emit, listen } from '@tauri-apps/api/event';


export class PluginAPI {
  private static instance: PluginAPI | null = null;
  private isInitialized = false;
  private serverPort = 3003;

  private constructor() {
    this.setupEventHandlers();
  }

  public static getInstance(): PluginAPI {
    if (!PluginAPI.instance) {
      PluginAPI.instance = new PluginAPI();
    }
    return PluginAPI.instance;
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


// Export as default for clean imports
export default PluginAPI.getInstance();