import type { 
  ApiRequest, 
  ApiResponse
} from './schema';
import { usePluginUI } from '../composables/usePluginUI';

// Create a global instance of the plugin UI
const pluginUI = usePluginUI();

export class UIManager {
  /**
   * Handle showToast API request
   */
  async showToast(request: ApiRequest): Promise<ApiResponse> {
    console.log('Showing toast:', request.params);
    
    pluginUI.showToast({
      message: request.params.message,
      type: request.params.type || 'info',
      duration: request.params.duration
    });
    
    return {
      request_id: request.request_id,
      success: true,
      data: { message: 'Toast shown successfully' }
    };
  }

  /**
   * Handle showModal API request
   */
  async showModal(request: ApiRequest): Promise<ApiResponse> {
    console.log('Showing modal:', request.params);
    
    try {
      const result = await pluginUI.showModal(request.params);
      
      return {
        request_id: request.request_id,
        success: true,
        data: result
      };
    } catch (error) {
      return {
        request_id: request.request_id,
        success: false,
        error: `Modal error: ${error}`
      };
    }
  }

  /**
   * Handle showConfirmation API request
   */
  async showConfirmation(request: ApiRequest): Promise<ApiResponse> {
    console.log('Showing confirmation:', request.params);
    
    try {
      const confirmed = await pluginUI.showConfirmation(request.params);
      
      return {
        request_id: request.request_id,
        success: true,
        data: confirmed
      };
    } catch (error) {
      return {
        request_id: request.request_id,
        success: false,
        error: `Confirmation error: ${error}`
      };
    }
  }

  /**
   * Handle showAlert API request
   */
  async showAlert(request: ApiRequest): Promise<ApiResponse> {
    console.log('Showing alert:', request.params);
    
    pluginUI.showAlert(request.params);
    
    return {
      request_id: request.request_id,
      success: true,
      data: { message: 'Alert shown successfully' }
    };
  }

  /**
   * Handle showDialog API request
   */
  async showDialog(request: ApiRequest): Promise<ApiResponse> {
    console.log('Showing dialog:', request.params);
    
    try {
      const result = await pluginUI.showDialog(request.params);
      
      return {
        request_id: request.request_id,
        success: true,
        data: result
      };
    } catch (error) {
      return {
        request_id: request.request_id,
        success: false,
        error: `Dialog error: ${error}`
      };
    }
  }

  /**
   * Handle hideModal API request
   */
  async hideModal(request: ApiRequest): Promise<ApiResponse> {
    console.log('Hiding modal:', request.params);
    
    pluginUI.hideModal();
    
    return {
      request_id: request.request_id,
      success: true,
      data: { message: 'Modal hidden successfully' }
    };
  }

  /**
   * Handle updateProgress API request
   */
  async updateProgress(request: ApiRequest): Promise<ApiResponse> {
    console.log('Updating progress:', request.params);
    
    pluginUI.updateProgress(request.params);
    
    return {
      request_id: request.request_id,
      success: true,
      data: { message: 'Progress updated successfully' }
    };
  }

  /**
   * Handle setTheme API request
   */
  async setTheme(request: ApiRequest): Promise<ApiResponse> {
    console.log('Setting theme:', request.params);
    
    pluginUI.setTheme(request.params);
    
    return {
      request_id: request.request_id,
      success: true,
      data: { message: `Theme set to ${request.params.theme}` }
    };
  }
}

// Export singleton instance
export const uiManager = new UIManager();

// Also export the composable for direct use in Vue components
export { pluginUI }; 