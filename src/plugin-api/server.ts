import { invoke } from '@tauri-apps/api/tauri';
import { emit, listen } from '@tauri-apps/api/event';
import type { PluginAPI } from './schema';

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

export interface UIElement {
  id: string;
  element_type: string;
  config: any;
  plugin_id: string;
}

export class PluginAPIServer {
  private pluginUIElements = new Map<string, UIElement>();
  private isInitialized = false;
  private serverPort = 3001;

  constructor() {
    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('Initializing Plugin API Server...');
    
    try {
      // Start the Rust WebSocket server
      await invoke('start_plugin_server', { port: this.serverPort });
      
      // Setup event listeners for plugin events
      await this.setupTauriEventListeners();
      
      this.isInitialized = true;
      console.log(`Plugin API Server initialized on port ${this.serverPort}`);
    } catch (error) {
      console.error('Failed to initialize Plugin API Server:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;
    
    try {
      await invoke('stop_plugin_server');
      this.pluginUIElements.clear();
      this.isInitialized = false;
      console.log('Plugin API Server shutdown complete');
    } catch (error) {
      console.error('Error shutting down Plugin API Server:', error);
    }
  }

  async sendToPlugin(pluginId: string, message: PluginMessage): Promise<void> {
    try {
      await invoke('send_to_plugin', { pluginId, message });
    } catch (error) {
      console.error(`Failed to send message to plugin ${pluginId}:`, error);
      throw error;
    }
  }

  async getConnectedPlugins(): Promise<PluginInfo[]> {
    try {
      return await invoke('get_connected_plugins');
    } catch (error) {
      console.error('Failed to get connected plugins:', error);
      return [];
    }
  }

  async getUIElements(): Promise<UIElement[]> {
    try {
      const elements = await invoke('get_ui_elements');
      return elements as UIElement[];
    } catch (error) {
      console.error('Failed to get UI elements:', error);
      return [];
    }
  }

  private async setupEventHandlers(): Promise<void> {
    console.log('Setting up event handlers...');
  }

  private async setupTauriEventListeners(): Promise<void> {
    // Listen for plugin connection events
    await listen('plugin/connected', (event: any) => {
      const { plugin_id, info } = event.payload;
      console.log(`Plugin connected: ${plugin_id}`, info);
      this.handlePluginConnected(plugin_id, info);
    });

    await listen('plugin/disconnected', (event: any) => {
      const { plugin_id } = event.payload;
      console.log(`Plugin disconnected: ${plugin_id}`);
      this.handlePluginDisconnected(plugin_id);
    });

    // Listen for plugin API requests
    await listen('plugin/api_request', (event: any) => {
      const { plugin_id, request } = event.payload;
      this.handlePluginAPIRequest(plugin_id, request);
    });

    // Listen for plugin UI element registration
    await listen('plugin/ui_element', (event: any) => {
      const { plugin_id, element } = event.payload;
      this.handlePluginUIElement(plugin_id, element);
    });

    // Listen for plugin messages
    await listen('plugin/message', (event: any) => {
      const { plugin_id, message } = event.payload;
      this.handlePluginMessage(plugin_id, message);
    });

    // Listen for server events
    await listen('plugin_server/started', (event: any) => {
      const { port } = event.payload;
      console.log(`Plugin server started on port ${port}`);
    });

    await listen('plugin_server/stopped', () => {
      console.log('Plugin server stopped');
    });

    // Listen for frontend events
    await listen('plugin/button/pressed', (event: any) => {
      const { buttonId } = event.payload;
      this.triggerButtonPress(buttonId);
    });

    await listen('plugin/input/changed', (event: any) => {
      const { inputId, value } = event.payload;
      this.updateInputValue(inputId, value);
    });
  }

  private handlePluginConnected(pluginId: string, info: PluginInfo): void {
    console.log(`Plugin ${pluginId} connected:`, info);
    // Emit to main app
    emit('plugin/connected', { pluginId, info });
  }

  private handlePluginDisconnected(pluginId: string): void {
    console.log(`Plugin ${pluginId} disconnected`);
    
    // Clean up UI elements for this plugin
    const elementsToRemove: string[] = [];
    for (const [id, element] of this.pluginUIElements.entries()) {
      if (element.plugin_id === pluginId) {
        elementsToRemove.push(id);
      }
    }
    
    for (const id of elementsToRemove) {
      this.pluginUIElements.delete(id);
      emit('plugin/ui/removeElement', { id });
    }

    // Emit to main app
    emit('plugin/disconnected', { pluginId });
  }

  private async handlePluginAPIRequest(pluginId: string, request: any): Promise<void> {
    try {
      const { id, method, params } = request;
      
      let result;
      switch (method) {
        case 'settings.addButton':
          result = await this.addSettingsButton(params, pluginId);
          break;
        case 'settings.addInput':
          result = await this.addSettingsInput(params, pluginId);
          break;
        case 'ui.showNotification':
          result = await this.showNotification(params.message);
          break;
        case 'ui.openModal':
          result = await this.openModal(params.content);
          break;
        default:
          throw new Error(`Unknown API method: ${method}`);
      }

      // Send response back to plugin
      const response: PluginMessage = {
        plugin_id: pluginId,
        message_type: 'api_response',
        data: { id, result }
      };
      
      await this.sendToPlugin(pluginId, response);
    } catch (error) {
      console.error('Error handling plugin API request:', error);
      
      // Send error response back to plugin
      const errorResponse: PluginMessage = {
        plugin_id: pluginId,
        message_type: 'api_response',
        data: { 
          id: request.id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      };
      
      await this.sendToPlugin(pluginId, errorResponse);
    }
  }

  private handlePluginUIElement(pluginId: string, element: UIElement): void {
    this.pluginUIElements.set(element.id, element);
    
    // Emit to main app based on element type
    if (element.element_type === 'button') {
      emit('plugin/settings/addButton', element);
    } else if (element.element_type === 'input') {
      emit('plugin/settings/addInput', element);
    }
  }

  private handlePluginMessage(pluginId: string, message: PluginMessage): void {
    console.log(`Plugin ${pluginId} sent message:`, message);
    // Forward to main app
    emit('plugin/event', { pluginId, message });
  }

  private generateSafeId(prefix: string): string {
    const timestamp = Date.now().toString();
    const randomPart = Math.random().toString().slice(2, 11);
    return `${prefix}_${timestamp}_${randomPart}`;
  }

  private async addSettingsButton(config: { title: string; icon?: string }, pluginId: string) {
    const id = this.generateSafeId('button');
    
    const buttonElement: UIElement = {
      id,
      element_type: 'button',
      config: {
        title: config.title,
        icon: config.icon
      },
      plugin_id: pluginId
    };

    this.pluginUIElements.set(id, buttonElement);
    
    // Emit to the main app
    await emit('plugin/settings/addButton', buttonElement);

    return { id };
  }

  private async addSettingsInput(config: { label: string; type: 'text' | 'password' | 'number' }, pluginId: string) {
    const id = this.generateSafeId('input');
    
    const inputElement: UIElement = {
      id,
      element_type: 'input',
      config: {
        label: config.label,
        inputType: config.type,
        value: ''
      },
      plugin_id: pluginId
    };

    this.pluginUIElements.set(id, inputElement);
    
    // Emit to the main app
    await emit('plugin/settings/addInput', inputElement);

    return { id, value: '' };
  }

  private async showNotification(message: string) {
    await emit('plugin/ui/showNotification', { message });
  }

  private async openModal(content: string) {
    await emit('plugin/ui/openModal', { content });
  }

  // Method to be called when a plugin button is pressed in the main app
  public async triggerButtonPress(buttonId: string): Promise<void> {
    const element = this.pluginUIElements.get(buttonId);
    if (element && element.element_type === 'button') {
      try {
        const message: PluginMessage = {
          plugin_id: element.plugin_id,
          message_type: 'button_press',
          data: { buttonId }
        };
        
        await this.sendToPlugin(element.plugin_id, message);
      } catch (error) {
        console.error(`Failed to trigger button press for ${buttonId}:`, error);
      }
    }
  }

  // Method to be called when a plugin input value changes in the main app
  public async updateInputValue(inputId: string, value: string): Promise<void> {
    const element = this.pluginUIElements.get(inputId);
    if (element && element.element_type === 'input') {
      element.config.value = value;
      
      try {
        const message: PluginMessage = {
          plugin_id: element.plugin_id,
          message_type: 'input_change',
          data: { inputId, value }
        };
        
        await this.sendToPlugin(element.plugin_id, message);
      } catch (error) {
        console.error(`Failed to update input value for ${inputId}:`, error);
      }
    }
  }

  // Method to get the current value of an input
  public getInputValue(inputId: string): string {
    const element = this.pluginUIElements.get(inputId);
    return element?.config?.value || '';
  }

  // Method to get all plugin UI elements (for rendering in settings)
  public getPluginUIElements(): UIElement[] {
    return Array.from(this.pluginUIElements.values());
  }

  // Check if server is running
  public isServerRunning(): boolean {
    return this.isInitialized;
  }

  // Get server port
  public getServerPort(): number {
    return this.serverPort;
  }
}

// Export a singleton instance
export const pluginAPIServer = new PluginAPIServer(); 