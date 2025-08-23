import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import type { 
  ApiRequest, 
  ApiResponse
} from './schema';
import { settingsManager } from './settings';
import { uiManager } from './ui';
import { useStore } from '../store/store';

export class PluginAPI {
  private static instance: PluginAPI | null = null;
  private isInitialized = false;
  // --- ACTION helpers ---
  async emitAction(plugin_id: string, action: string, params: any = {}) {
    console.log('Emitting action', action, params);
    try {
      await invoke('send_to_plugin', { pluginId: plugin_id, event: 'plugin.action', data: { action, params } });
      console.log('Emitted action', action);
    } catch (err) {
      console.error('Failed to emit action', err);
    }
  }
  private serverPort = 3001;

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
    // TODO: Implement event handlers for events from frontend
  }

  // Events from plugins
  setupTauriEventListeners() {
    listen('plugin/api_request', (event) => {
      console.log('Received API request:', event.payload);
      this.handleApiRequest(event.payload as ApiRequest & { plugin_id?: string });
    });
    listen('plugin/api_response', (event) => {
      console.log('Received API response:', event.payload);
    });
    listen('plugin/api_error', (event) => {
      console.log('Received API error:', event.payload);
    });
    listen('plugin/api_event', (event) => {
      console.log('Received API event:', event.payload);
    });
    listen('plugin/connected', (event) => {
      const pluginID = (event.payload as { id: string }).id;
      useStore().addActivePlugin(pluginID);
      console.log('Received connected event:', event.payload);
    });
    listen('plugin/disconnected', (event) => {
      const pluginID = (event.payload as { id: string }).id;
      useStore().removeActivePlugin(pluginID);
      console.log('Received disconnected event:', event.payload);
    });
  }

  /**
   * Handle incoming API requests from plugins
   */
  private async handleApiRequest(request: ApiRequest) {
    console.log(`Handling API request: ${request.method}`);
    
    try {
      let response: ApiResponse;

      // Check if this is a settings method
      if (request.method.startsWith('settings.')) {
        const methodName = request.method.split('.')[1];
        
        // Check if the method exists in settingsManager
        if (typeof settingsManager[methodName as keyof typeof settingsManager] === 'function') {
          response = await (settingsManager[methodName as keyof typeof settingsManager] as Function)(request);
        } else {
          response = {
            request_id: request.request_id,
            success: false,
            error: `Unknown settings method: ${methodName}`
          };
        }
      } else if (request.method.startsWith('ui.')) {
        // Check if this is a UI method
        const methodName = request.method.split('.')[1];
        
        // Check if the method exists in uiManager
        if (typeof uiManager[methodName as keyof typeof uiManager] === 'function') {
          response = await (uiManager[methodName as keyof typeof uiManager] as Function)(request);
        } else {
          response = {
            request_id: request.request_id,
            success: false,
            error: `Unknown UI method: ${methodName}`
          };
        }
      } else {
        // Handle other methods with switch case if needed
        response = {
          request_id: request.request_id,
          success: false,
          error: `Unknown API method: ${request.method}`
        };
      }

      // Send the response back through the Rust backend
      await this.sendApiResponse(response);

    } catch (error) {
      console.error('Error handling API request:', error);
      
      const errorResponse: ApiResponse = {
        request_id: request.request_id,
        success: false,
        error: `Internal error: ${error instanceof Error ? error.message : String(error)}`
      };
      
      await this.sendApiResponse(errorResponse);
    }
  }

  /**
   * Send API response back to plugin through Rust backend
   */
  private async sendApiResponse(response: ApiResponse) {
    try {
      await invoke('send_api_response', { response });
      console.log('API response sent successfully:', response.request_id);
    } catch (error) {
      console.error('Failed to send API response:', error);
    }
  }


  // Generic request/response helper for plugin communications using a single request topic and method
  private async pluginRequest<T = any>(pluginId: string, method: string, params: any = {}): Promise<T> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const data = { method, params, request_id: requestId };

    const response = await invoke('send_to_plugin_with_ack', {
      pluginId,
      event: 'plugin.request',
      data,
    }) as ApiResponse;

    if (!response.success) {
      throw new Error(response.error || 'Plugin request failed');
    }
    return response.data as T;
  }


  public async getPluginSettings(pluginId: string) {
    console.log('Getting plugin settings for plugin:', pluginId);
    const settings = await this.pluginRequest(pluginId, 'get_plugin_settings');
    console.log('Plugin settings received:', settings);
    return settings.data;
  }

}

// Export as default for clean imports
export default PluginAPI.getInstance();