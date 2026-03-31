import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { 
  ApiRequest, 
  ApiResponse
} from './schema';
import { settingsManager } from './settings';
import { uiManager } from './ui';
import { useStore } from '../store/store';
import { useDeckerStore } from "../store/deckerStore.ts";
import EventBus from '../js/eventBus.js';
import RGBController from '../ts/RGBController';
import ConfigStore from '../ts/config';

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
  private preferredPort = 3001;
  private serverPort = 0; // Actual port will be set after server starts

  private constructor() {
    this.setupEventHandlers();
    console.log('hellow')

    setTimeout(() => {
      console.log('hallowwwwwwwwwwwwwwwwwwww')
      const deckerStore = useDeckerStore();
      console.log('deckystore', deckerStore)
      console.log('Sliders:', deckerStore.getSliders);
      
    }, 5000);
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
      // Start the Rust WebSocket server - it returns the actual port used
      const actualPort = await invoke<number>('start_plugin_server', { port: this.preferredPort });
      this.serverPort = actualPort;
      
      if (actualPort !== this.preferredPort) {
        console.log(`Plugin API Server started on port ${actualPort} (preferred port ${this.preferredPort} was busy)`);
      } else {
        console.log('Plugin API Server started on port', actualPort);
      }
      
      // Setup event listeners for plugin events
      await this.setupTauriEventListeners();
      
      // Sync active plugins with backend to handle renderer resets
      await this.syncActivePlugins();
      
      this.isInitialized = true;
      console.log(`Plugin API Server initialized on port ${this.serverPort}`);
      
      // Now it's safe to access stores after initialization
      this.logSliderValues();
    } catch (error) {
      console.error('Failed to initialize Plugin API Server:', error);
      throw error;
    }
  }

  /**
   * Get the current plugin server port
   */
  public getServerPort(): number {
    return this.serverPort;
  }

  /**
   * Safely access and log slider values from deckerStore
   */
  private logSliderValues() {
    try {
      const deckerStore = useDeckerStore();
      deckerStore.sliders.forEach((value, index) => {
        console.log(`Slider ${index} value: ${value}%`);
      });
    } catch (error) {
      console.warn('Could not access decker store:', error);
    }
  }

  /**
   * Get current slider values
   */
  public getSliders(): number[] {
    try {
      const deckerStore = useDeckerStore();
      return deckerStore.sliders;
    } catch (error) {
      console.warn('Could not access decker store:', error);
      return [];
    }
  }

  async setupEventHandlers() {
    // TODO: Implement event handlers for events from frontend
    EventBus.on('device-update', async (data: any) => {
      try {
       await invoke('broadcast_to_plugins', { event: 'plugin.device_update', data });
      } catch (err) {
        console.error('Failed to emit action', err);
      }
      // Handle the slider change event as needed
    });

    // Listen for device connection state changes
    EventBus.on('connectionChange', async (data: any) => {
      try {
        const deviceInfo = await this.getDeviceInfo();
        if (data.connected) {
          console.log('Broadcasting device connected event to plugins', deviceInfo);
          await invoke('broadcast_to_plugins', { event: 'plugin.device_connected', data: deviceInfo });
        } else {
          console.log('Broadcasting device disconnected event to plugins', deviceInfo);
          await invoke('broadcast_to_plugins', { event: 'plugin.device_disconnected', data: deviceInfo });
        }
      } catch (err) {
        console.error('Failed to broadcast device connection event', err);
      }
    });
  }

  /**
   * Get current device information
   */
  private async getDeviceInfo() {
    const deckerStore = useDeckerStore();
    const comPort = await ConfigStore.get('comPort') || 'Unknown';
    
    return {
      name: 'Decker',
      port: comPort,
      state: deckerStore.connected ? 'connected' : 'disconnected',
      connected_at: new Date().toISOString()
    };
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
      const plugin = event.payload as { id: string; name: string; version?: string; connected_at?: string };
      useStore().upsertConnectedPlugin(plugin);
      console.log('Received connected event:', event.payload);
    });
    listen('plugin/disconnected', (event) => {
      const pluginID = (event.payload as { id: string }).id;
      useStore().removeConnectedPlugin(pluginID);
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
      } else if (request.method === 'get_sliders') {
        // Handle slider data requests
        try {
          const sliders = this.getSliders();
          response = {
            request_id: request.request_id,
            success: true,
            data: { sliders }
          };
        } catch (error) {
          response = {
            request_id: request.request_id,
            success: false,
            error: `Failed to get sliders: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      } else if (request.method === 'device.getConnected') {
        // Handle device connection status requests
        try {
          const deviceInfo = await this.getDeviceInfo();
          const devices = deviceInfo.state === 'connected' ? [deviceInfo] : [];
          response = {
            request_id: request.request_id,
            success: true,
            data: { devices }
          };
        } catch (error) {
          response = {
            request_id: request.request_id,
            success: false,
            error: `Failed to get device info: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      } else if (request.method.startsWith('rgb.')) {
        // Handle RGB control methods
        const methodName = request.method.split('.')[1];
        
        try {
          if (methodName === 'setEffect') {
            const { effectName, speed, brightness, color } = request.params;
            RGBController.setEffect(effectName, speed, brightness, color);
            response = {
              request_id: request.request_id,
              success: true,
              data: { effectName, speed, brightness, color }
            };
          } else if (methodName === 'getAvailableEffects') {
            response = {
              request_id: request.request_id,
              success: true,
              data: { effects: RGBController.effects }
            };
          } else {
            response = {
              request_id: request.request_id,
              success: false,
              error: `Unknown RGB method: ${methodName}`
            };
          }
        } catch (error) {
          response = {
            request_id: request.request_id,
            success: false,
            error: `RGB control error: ${error instanceof Error ? error.message : String(error)}`
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

  public async getPluginActions(pluginId: string) {
    console.log('Getting actions for plugin:', pluginId);
    const actions = await this.pluginRequest(pluginId, 'get_actions');
    console.log('Actions received:', actions);
    return actions.data;
  }

  public async getConnectedPlugins() {
    try {
      const plugins = await invoke('get_connected_plugins');
      return plugins as Array<{ id: string; name: string; version: string; connected_at: string }>;
    } catch (e) {
      console.error('Failed to get connected plugins', e);
      return [] as any[];
    }
  }

  /**
   * Sync the active plugins list with currently connected plugins from the backend.
   * This ensures the store stays in sync even if the renderer resets.
   */
  private async syncActivePlugins() {
    try {
      const connectedPlugins = await this.getConnectedPlugins();
      useStore().setConnectedPlugins(connectedPlugins);
    } catch (error) {
      console.error('Failed to sync active plugins:', error);
    }
  }

}

// Export as default for clean imports
export default PluginAPI.getInstance();
