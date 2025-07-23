import type { 
  ApiRequest, 
  ApiResponse
} from './schema';

export class UIManager {
  /**
   * Handle showToast API request
   */
  async showToast(request: ApiRequest): Promise<ApiResponse> {
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
  async showModal(request: ApiRequest): Promise<ApiResponse> {
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
  async showConfirmation(request: ApiRequest): Promise<ApiResponse> {
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
   * Handle showAlert API request
   */
  async showAlert(request: ApiRequest): Promise<ApiResponse> {
    console.log('Showing alert:', request.params);
    
    const { title, message, type } = request.params;
    
    // Simulate showing an alert
    console.log(`Alert [${type || 'info'}]: ${title} - ${message}`);
    
    return {
      request_id: request.request_id,
      success: true,
      data: { message: 'Alert shown successfully' }
    };
  }

  /**
   * Handle showNotification API request
   */
  async showNotification(request: ApiRequest): Promise<ApiResponse> {
    console.log('Showing notification:', request.params);
    
    const { title, body, icon, actions } = request.params;
    
    // Simulate showing a system notification
    console.log(`Notification: ${title} - ${body}`);
    
    return {
      request_id: request.request_id,
      success: true,
      data: { message: 'Notification shown successfully' }
    };
  }

  /**
   * Handle showDialog API request
   */
  async showDialog(request: ApiRequest): Promise<ApiResponse> {
    console.log('Showing dialog:', request.params);
    
    const { title, content, buttons } = request.params;
    
    // Simulate showing a custom dialog
    const mockResult = {
      button: buttons?.[0]?.label || 'OK',
      cancelled: false,
      data: null
    };
    
    return {
      request_id: request.request_id,
      success: true,
      data: mockResult
    };
  }

  /**
   * Handle hideModal API request
   */
  async hideModal(request: ApiRequest): Promise<ApiResponse> {
    console.log('Hiding modal:', request.params);
    
    // Simulate hiding the current modal
    await new Promise(resolve => setTimeout(resolve, 25));
    
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
    
    const { value, message } = request.params;
    
    // Simulate updating a progress indicator
    console.log(`Progress: ${value}% - ${message || ''}`);
    
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
    
    const { theme } = request.params;
    
    // Simulate setting the UI theme
    console.log(`Theme set to: ${theme}`);
    
    return {
      request_id: request.request_id,
      success: true,
      data: { message: `Theme set to ${theme}` }
    };
  }
}

// Export singleton instance
export const uiManager = new UIManager(); 