import type { 
  ApiRequest, 
  ApiResponse
} from './schema';
import EventBus from '../js/eventBus';

export class UIManager {
  /**
   * Handle showToast API request
   */
  async showToast(request: ApiRequest): Promise<ApiResponse> {
    console.log('Showing toast:', request.params);
    
    try {
      EventBus.emit('plugin:showToast', { 
        message: request.params.message, 
        type: request.params.type || 'info', 
        duration: request.params.duration 
      });
      
      return {
        request_id: request.request_id,
        success: true,
        data: { message: 'Toast shown successfully' }
      };
    } catch (error) {
      return {
        request_id: request.request_id,
        success: false,
        error: `Toast error: ${error}`
      };
    }
  }

  async updated(_request: ApiRequest & { plugin_id?: string }): Promise<ApiResponse> {
    try {
      // Broadcast that a plugin's settings changed so the UI can refresh
      EventBus.emit('plugin:settingsUpdated', { pluginId: _request && (_request as any).plugin_id });
      return {
        request_id: _request.request_id,
        success: true,
        data: { message: 'Settings update broadcasted' }
      };
    } catch (error) {
      return {
        request_id: _request.request_id,
        success: false,
        error: `Settings updated error: ${error}`
      };
    }
  }

}

// Export singleton instance
export const uiManager = new UIManager(); 