import type { 
  ApiRequest, 
  ApiResponse
} from './schema';

// Helper function to get the plugin UI instance
function getPluginUI() {
  if ((window as any).pluginUIInstance) {
    return (window as any).pluginUIInstance;
  }
  throw new Error('Plugin UI instance not available');
}

export class UIManager {
  /**
   * Handle showToast API request
   */
  async showToast(request: ApiRequest): Promise<ApiResponse> {
    console.log('Showing toast:', request.params);
    
    try {
      const pluginUI = getPluginUI();
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
    } catch (error) {
      return {
        request_id: request.request_id,
        success: false,
        error: `Toast error: ${error}`
      };
    }
  }

  /**
   * Handle showModal API request
   */
  async showModal(request: ApiRequest): Promise<ApiResponse> {
    console.log('Showing modal:', request.params);
    
    try {
      const pluginUI = getPluginUI();
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
      const pluginUI = getPluginUI();
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
    
    try {
      const pluginUI = getPluginUI();
      pluginUI.showAlert(request.params);
      
      return {
        request_id: request.request_id,
        success: true,
        data: { message: 'Alert shown successfully' }
      };
    } catch (error) {
      return {
        request_id: request.request_id,
        success: false,
        error: `Alert error: ${error}`
      };
    }
  }

  /**
   * Handle showDialog API request
   */
  async showDialog(request: ApiRequest): Promise<ApiResponse> {
    console.log('Showing dialog:', request.params);
    
    try {
      const pluginUI = getPluginUI();
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
    
    try {
      const pluginUI = getPluginUI();
      pluginUI.hideModal();
      
      return {
        request_id: request.request_id,
        success: true,
        data: { message: 'Modal hidden successfully' }
      };
    } catch (error) {
      return {
        request_id: request.request_id,
        success: false,
        error: `Hide modal error: ${error}`
      };
    }
  }

  /**
   * Handle updateProgress API request
   */
  async updateProgress(request: ApiRequest): Promise<ApiResponse> {
    console.log('Updating progress:', request.params);
    
    try {
      const pluginUI = getPluginUI();
      pluginUI.updateProgress(request.params);
      
      return {
        request_id: request.request_id,
        success: true,
        data: { message: 'Progress updated successfully' }
      };
    } catch (error) {
      return {
        request_id: request.request_id,
        success: false,
        error: `Progress error: ${error}`
      };
    }
  }

  /**
   * Handle setTheme API request
   */
  async setTheme(request: ApiRequest): Promise<ApiResponse> {
    console.log('Setting theme:', request.params);
    
    try {
      const pluginUI = getPluginUI();
      pluginUI.setTheme(request.params);
      
      return {
        request_id: request.request_id,
        success: true,
        data: { message: `Theme set to ${request.params.theme}` }
      };
    } catch (error) {
      return {
        request_id: request.request_id,
        success: false,
        error: `Theme error: ${error}`
      };
    }
  }
}

// Export singleton instance
export const uiManager = new UIManager(); 