import type { 
  ApiRequest, 
  ApiResponse
} from './schema';
import EventBus from '../js/eventBus';
import { usePluginStore } from '../store/pluginStore';
import { createLogger } from '../ts/logger.ts';

const log = createLogger('plugin-ui');

export class UIManager {
  /**
   * Handle showToast API request
   */
  async showToast(request: ApiRequest): Promise<ApiResponse> {
    log.debug('Showing toast:', request.params);
    
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

  async actionsUpdated(_request: ApiRequest & { plugin_id?: string }): Promise<ApiResponse> {
    try {
      // Broadcast that a plugin's action mappings changed so the UI can refresh
      const pluginId = _request && (_request as any).plugin_id;
      EventBus.emit('plugin:actionsUpdated', { pluginId });
      if (pluginId) {
        void usePluginStore().refreshPluginSystemUtilityButtons(pluginId);
      } else {
        void usePluginStore().refreshPluginSystemUtilityButtons();
      }
      return {
        request_id: _request.request_id,
        success: true,
        data: { message: 'Actions update broadcasted' }
      };
    } catch (error) {
      return {
        request_id: _request.request_id,
        success: false,
        error: `Actions updated error: ${error}`
      };
    }
  }

}

// Export singleton instance
export const uiManager = new UIManager(); 
