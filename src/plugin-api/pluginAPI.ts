import { invoke } from '@tauri-apps/api/tauri';
import { emit, listen } from '@tauri-apps/api/event';
import type { 
  ApiRequest, 
  ApiResponse, 
  CreateSettingsParams, 
  SettingsSchema,
  SettingsField 
} from './schema';

export class PluginAPI {
  private static instance: PluginAPI | null = null;
  private isInitialized = false;
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
    // TODO: Implement event handlers
  }

  setupTauriEventListeners() {
    listen('plugin/api_request', (event) => {
      console.log('Received API request:', event.payload);
      this.handleApiRequest(event.payload as ApiRequest);
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
      console.log('Received connected event:', event.payload);
    });
    listen('plugin/disconnected', (event) => {
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

      switch (request.method) {
        case 'settings.createSettings':
          response = await this.handleCreateSettings(request);
          break;
        
        case 'settings.setValue':
          response = await this.handleSetValue(request);
          break;
        
        case 'settings.getValue':
          response = await this.handleGetValue(request);
          break;
        
        case 'ui.showToast':
          response = await this.handleShowToast(request);
          break;
        
        case 'ui.showModal':
          response = await this.handleShowModal(request);
          break;
        
        case 'ui.showConfirmation':
          response = await this.handleShowConfirmation(request);
          break;
        
        default:
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
   * Handle createSettings API request
   */
  private async handleCreateSettings(request: ApiRequest): Promise<ApiResponse> {
    console.log('Creating settings for plugin:', request.params);
    
    const params = request.params as CreateSettingsParams;
    
    // Validate the schema
    if (!params.schema || typeof params.schema !== 'object') {
      return {
        request_id: request.request_id,
        success: false,
        error: 'Invalid schema: schema must be an object'
      };
    }

    // Simulate processing the settings creation
    const settingsId = `settings_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Log the schema for testing
    console.log('Settings schema received:', JSON.stringify(params.schema, null, 2));
    console.log('Settings options received:', JSON.stringify(params.options, null, 2));
    
    // Simulate some async work (e.g., creating UI, validating fields)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate success response
    const successData = {
      success: true,
      settingsId: settingsId,
      message: 'Settings created successfully'
    };

    return {
      request_id: request.request_id,
      success: true,
      data: successData
    };
  }

  /**
   * Handle setValue API request
   */
  private async handleSetValue(request: ApiRequest): Promise<ApiResponse> {
    console.log('Setting value:', request.params);
    
    // Simulate setting a value
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      request_id: request.request_id,
      success: true,
      data: { message: 'Value set successfully' }
    };
  }

  /**
   * Handle getValue API request
   */
  private async handleGetValue(request: ApiRequest): Promise<ApiResponse> {
    console.log('Getting value for key:', request.params.key);
    
    // Simulate getting a value
    const mockValue = `mock_value_for_${request.params.key}`;
    
    return {
      request_id: request.request_id,
      success: true,
      data: mockValue
    };
  }

  /**
   * Handle showToast API request
   */
  private async handleShowToast(request: ApiRequest): Promise<ApiResponse> {
    console.log('Showing toast:', request.params);
    
    // Simulate showing a toast notification
    // In a real implementation, you would integrate with your toast system
    console.log(`Toast: ${request.params.message} (${request.params.type || 'info'})`);
    
    return {
      request_id: request.request_id,
      success: true,
      data: { message: 'Toast shown successfully' }
    };
  }

  /**
   * Handle showModal API request
   */
  private async handleShowModal(request: ApiRequest): Promise<ApiResponse> {
    console.log('Showing modal:', request.params);
    
    // Simulate showing a modal and getting user input
    const mockResult = {
      button: 'confirm',
      cancelled: false
    };
    
    return {
      request_id: request.request_id,
      success: true,
      data: mockResult
    };
  }

  /**
   * Handle showConfirmation API request
   */
  private async handleShowConfirmation(request: ApiRequest): Promise<ApiResponse> {
    console.log('Showing confirmation:', request.params);
    
    // Simulate user confirming
    const confirmed = true;
    
    return {
      request_id: request.request_id,
      success: true,
      data: confirmed
    };
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

  /**
   * Test method to simulate a createSettings request manually
   */
  public async testCreateSettings() {
    console.log('Testing createSettings method...');
    
    const mockRequest: ApiRequest = {
      method: 'settings.createSettings',
      params: {
        schema: {
          myText: {
            type: "text",
            label: "Text Input",
            placeholder: "Enter text here",
            default: "Hello World"
          },
          myBoolean: {
            type: "boolean", 
            label: "Enable Feature",
            default: true
          },
          mySelect: {
            type: "select",
            label: "Choose Option",
            options: [
              { value: "option1", label: "Option 1" },
              { value: "option2", label: "Option 2" }
            ],
            default: "option1"
          },
          myNumber: {
            type: "number",
            label: "Number Input",
            min: 0,
            max: 100,
            default: 50
          }
        },
        options: {
          defaultTab: "general",
          showTabIcons: true,
          tabPosition: "top",
          autoSave: true,
          tabs: {
            general: {
              title: "General",
              icon: "⚙️"
            },
            advanced: {
              title: "Advanced",
              icon: "🔧"
            }
          }
        }
      },
      request_id: 'req_1753301317785_3ds4mx2o9'
    };

    await this.handleApiRequest(mockRequest);
  }
}

// Export as default for clean imports
export default PluginAPI.getInstance();