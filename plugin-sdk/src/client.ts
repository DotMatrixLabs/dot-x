import { io, Socket } from 'socket.io-client';
import type { SettingsSections, CreateSettingsParams, ToastParams, ActionMappings, SystemUtilButton } from './types';

/**
 * Plugin metadata for registration with the Dot X application.
 * 
 * @group Advanced/Internal
 */
export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  connected_at: string;
}

/**
 * API request structure for Socket.IO communication.
 * 
 * @internal
 * @group Advanced/Internal
 */
export interface ApiRequest {
  method: string;
  params: any;
  request_id: string;
}

/**
 * API response structure from Socket.IO communication.
 * 
 * @internal
 * @group Advanced/Internal
 */
export interface ApiResponse {
  request_id: string;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Configuration options for plugin connection behavior.
 * 
 * Customize connection retry logic, timeouts, and server URL.
 * 
 * @group Advanced/Internal
 * 
 * @example
 * ```typescript
 * const config: ConnectionConfig = {
 *   serverUrl: 'http://localhost:3001',
 *   maxRetries: 10,
 *   retryDelay: 3000,
 *   connectionTimeout: 15000,
 *   registrationTimeout: 20000,
 *   apiTimeout: 30000
 * };
 * 
 * if (require.main === module) {
 *   runPlugin(MyPlugin, config);
 * }
 * ```
 */
export interface ConnectionConfig {
  /** Plugin server URL. Default: 'http://127.0.0.1:3001' */
  serverUrl?: string;
  /** Maximum connection retry attempts. Default: 5 */
  maxRetries?: number;
  /** Delay between retry attempts in milliseconds. Default: 2000 */
  retryDelay?: number;
  /** Connection timeout in milliseconds. Default: 10000 */
  connectionTimeout?: number;
  /** Registration timeout in milliseconds. Default: 15000 */
  registrationTimeout?: number;
  /** API request timeout in milliseconds. Default: 30000 */
  apiTimeout?: number;
}

/**
 * Device update event data containing control value changes.
 * 
 * @group Advanced/Internal
 */
export interface DeviceChanges {
  changes: Array<{ index: number; oldValue: number; newValue: number }>;
  values: Array<{ value: number }>;
}

/**
 * Internal API client for Socket.IO communication with Dot X application.
 * 
 * This class handles low-level socket communication, connection management,
 * and API request/response cycles. Most plugin developers will not interact
 * with this class directly.
 * 
 * @group Advanced/Internal
 */
export class APIClient {
  private socket: Socket;
  private isRegistered = false;
  private pluginInfo: PluginInfo;
  private config: Required<ConnectionConfig>;
  private retryCount = 0;
  // Registry for settings action callbacks (e.g., button clicks, text onChange)
  private actionCallbacks = new Map<string, (value?: any) => void>();
  private isDestroyed = false;
  private connectionPromise: Promise<void>;
  private settingsSchema?: SettingsSections;
  private actionMappings?: ActionMappings;
  
  constructor(pluginInfo: PluginInfo, config: ConnectionConfig = {}) {
    this.pluginInfo = pluginInfo;
    this.config = {
      serverUrl: config.serverUrl || 'http://127.0.0.1:3001',
      maxRetries: config.maxRetries || 5,
      retryDelay: config.retryDelay || 2000,
      connectionTimeout: config.connectionTimeout || 10000,
      registrationTimeout: config.registrationTimeout || 15000,
      apiTimeout: config.apiTimeout || 30000
    };
    this.connectionPromise = this.initializeConnection();
  }
  
  // Expose the connection promise for external waiting
  waitForConnection(): Promise<void> {
    return this.connectionPromise;
  }

  private deviceUpdateCallback?: (data: DeviceChanges) => Promise<DeviceChanges | void>;

  async onDeviceUpdate(data: DeviceChanges) {
    if (this.isDestroyed) return;
    if (this.deviceUpdateCallback) {
      const result = await this.deviceUpdateCallback(data);
      return result || data;
    }
    return data;
  }

  public setDeviceUpdateCallback(callback: (data: DeviceChanges) => Promise<DeviceChanges | void>) {
    this.deviceUpdateCallback = callback;
  }
  
  private initializeConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const connect = () => {
        if (this.isDestroyed) return;
        
        console.log(`Attempting to connect to plugin server at ${this.config.serverUrl}...`);
        
        this.socket = io(this.config.serverUrl, {
          timeout: this.config.connectionTimeout,
          forceNew: true,
          autoConnect: true,
          reconnection: true
        });
        
        // Attach core listeners as early as possible to avoid races where
        // the app emits events immediately after registration.
        // These listeners are idempotent per-socket instance.
        this.socket.on('plugin.action', (data: { action: string; params?: any }) => {
          console.log('Received action!', data);
          const cb = this.actionCallbacks.get(data.action);
          if (cb) {
            try {
              cb(data.params);
            } catch (err) {
              console.error('Error executing action callback:', err);
            }
          }
        });

        this.socket.on('plugin.device_update', (data: DeviceChanges) => {
          console.log('Received device update event');
          this.onDeviceUpdate(data);
        });

        // Request handler from app: single topic with method routing
        this.socket.on('plugin.request', (data: { method: string; params?: any; request_id?: string }, ack: (response: any) => void) => {
          console.log('Received plugin request:', data);
          const { method, request_id } = data || {};
          let response: any = { success: false, error: 'Unknown method', request_id, method };

          if (method === 'get_plugin_settings') {
            const payload = this.settingsSchema;
            response = payload
              ? { success: true, data: payload, request_id, method }
              : { success: false, error: 'Settings not initialized', request_id, method };
          } else if (method === 'get_actions') {
            const payload = this.actionMappings;
            response = payload
              ? { success: true, data: payload, request_id, method }
              : { success: true, data: { buttons: [] }, request_id, method };
          }

          ack(response);
        });

        this.socket.onAny((eventName, ...args) => {
          console.log(`Received event: ${eventName} with arguments:`, args);
        });
        
        const registrationTimeoutId = setTimeout(() => {
          if (!this.isRegistered) {
            const errorMsg = this.retryCount >= this.config.maxRetries 
              ? `Plugin registration failed after ${this.config.maxRetries} attempts. Make sure the DotX application is running and the plugin server is started.`
              : 'Plugin registration timeout - server may not be running';
            reject(new Error(errorMsg));
          }
        }, this.config.registrationTimeout);
        
        const handleFailure = (error: any) => {
          if (this.isDestroyed) return;

          // Clean up listeners on the old socket to prevent memory leaks
          this.socket.off('connect');
          this.socket.off('disconnect');
          this.socket.off('error');
          this.socket.off('connect_error');
          
          if (this.retryCount < this.config.maxRetries) {
            this.retryCount++;
            console.log(`Connection failed (attempt ${this.retryCount}/${this.config.maxRetries}). Retrying in ${this.config.retryDelay}ms...`);
            console.log(`Error details: ${error.message || error}`);
            
            setTimeout(() => {
              if (!this.isDestroyed) {
                this.socket?.disconnect();
                connect();
              }
            }, this.config.retryDelay);
          } else {
            clearTimeout(registrationTimeoutId);
            const errorMessage = this.createDetailedErrorMessage(error);
            console.error('Max retry attempts reached. Plugin connection failed.');
            console.error('Error:', errorMessage);
            reject(new Error(errorMessage));
          }
        };
        
        this.socket.on('connect', () => {
          console.log('Connected to plugin server');
          this.retryCount = 0; // Reset retry count on successful connection
          
          this.socket.emit('register', this.pluginInfo, (ack: any) => {
            clearTimeout(registrationTimeoutId);
            console.log('Registration response:', ack);
            if (ack.status === 'success') {
              console.log('Plugin registered successfully!!');
              this.isRegistered = true;

              resolve();
            } else {
              console.error('Plugin registration failed:', ack);
              handleFailure(new Error(`Plugin registration failed: ${ack.message || 'Unknown error'}`));
            }
          });
        });
        
        this.socket.on('disconnect', (reason: string) => {
          console.log('Disconnected from plugin server:', reason);
          this.isRegistered = false;
          if (this.isDestroyed || reason === 'io client disconnect') {
            return;
          }
          handleFailure(new Error(`Disconnected: ${reason}`));
        });
        
        this.socket.on('error', (error: any) => {
          console.error('Socket error:', error);
          handleFailure(error);
        });
        
        this.socket.on('connect_error', (error: any) => {
          console.error('Failed to connect to plugin server:', error);
          handleFailure(error);
        });

        // No additional listeners required for the simplified settings API
      };

      connect();
    });
  }
  
  private createDetailedErrorMessage(error: any): string {
    const baseMessage = `Failed to connect to plugin server after ${this.config.maxRetries} attempts.`;
    
    if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
      return `${baseMessage}
      Possible causes:
      1. Dot X is not running
      2. The plugin server hasn't been started yet
      3. The server is running on a different port than expected (${this.config.serverUrl})

      Solutions:
      1. Make sure Dot X is running
      2. Wait for the application to fully load (the plugin server starts automatically)
      3. Check if another application is using port 3001
      4. Try restarting Dot X

      Technical details: Connection refused (${error.code || 'N/A'})`;
    }
    
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      return `${baseMessage}
      The connection attempt timed out. This usually means:
      1. A firewall is blocking the connection
      2. The server is not responding
      3. Network connectivity issues

      Technical details: Connection timeout (${error.code || 'N/A'})`;
    }
    
    return `${baseMessage}
      Technical details: ${error.message || error}`;
  }
  
  private async call(method: string, params: any): Promise<any> {
    
    if (!this.isRegistered) {
      throw new Error('Plugin registration failed');
    }
    
    if (this.isDestroyed) {
      throw new Error('Plugin client has been destroyed');
    }
    
    const apiRequest: ApiRequest = {
      method,
      params,
      request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`API request timeout: ${method} took longer than ${this.config.apiTimeout}ms`));
      }, this.config.apiTimeout);
      
      this.socket.emit('api_request', apiRequest, (response: ApiResponse) => {
        clearTimeout(timeout);
        
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(`API request failed (${method}): ${response.error || 'Unknown error'}`));
        }
      });
    });
  }

  public disconnect() {
    this.isDestroyed = true;
    if (this.socket) {
      this.socket.disconnect();
    }
    this.actionCallbacks.clear();
  }
  
  public isConnected(): boolean {
    return this.isRegistered && !this.isDestroyed;
  }
  
  public getConnectionStatus(): string {
    if (this.isDestroyed) return 'destroyed';
    if (this.isRegistered) return 'connected';
    if (this.socket?.connected) return 'connecting';
    return 'disconnected';
  }
  
  /**
   * @internal
   */
  get settings() {
    return {
    };
  }
  
  /**
   * Global UI methods for showing notifications and dialogs.
   * 
   * @group Global UI
   */
  get ui() {
    return {
      /**
       * Displays a toast notification to the user.
       * 
       * @group Global UI
       * 
       * @param params - Toast configuration
       * @param params.message - Message text to display
       * @param params.type - Notification type: 'info', 'success', 'warning', or 'error'
       * @param params.duration - Duration in milliseconds before auto-dismiss (default: 3000)
       * @returns Promise that resolves when the toast is shown
       * 
       * ## Parameters
       * 
       * | Parameter | Type | Required | Default | Description |
       * |-----------|------|----------|---------|-------------|
       * | `message` | `string` | Yes | - | The message to display |
       * | `type` | `'info' \| 'success' \| 'warning' \| 'error'` | No | `'info'` | Visual style of the toast |
       * | `duration` | `number` | No | `3000` | Auto-dismiss duration in milliseconds |
       * 
       * @example
       * ```typescript
       * // Success notification
       * await this.ui.showToast({
       *   message: 'Settings saved successfully!',
       *   type: 'success',
       *   duration: 3000
       * });
       * 
       * // Error notification
       * await this.ui.showToast({
       *   message: 'Failed to connect to server',
       *   type: 'error',
       *   duration: 5000
       * });
       * 
       * // Warning notification
       * await this.ui.showToast({
       *   message: 'This feature is experimental',
       *   type: 'warning'
       * });
       * 
       * // Info notification (default)
       * await this.ui.showToast({
       *   message: 'Processing your request...',
       *   type: 'info'
       * });
       * ```
       */
      showToast: (params: ToastParams) => this.call('ui.showToast', params),
    };
  }
  
  /**
   * Notifies the host application that settings schema has changed.
   * 
   * @internal
   */
  public async notifySettingsUpdated(): Promise<void> {
    if (!this.isConnected()) return;
    try {
      await this.call('ui.updated', {});
    } catch (err) {
      console.warn('Failed to notify settings updated:', err);
    }
  }

  /**
   * Notifies the host application that action mappings have changed.
   * 
   * @internal
   */
  public async notifyActionsUpdated(): Promise<void> {
    if (!this.isConnected()) return;
    try {
      await this.call('ui.actionsUpdated', {});
    } catch (err) {
      console.warn('Failed to notify actions updated:', err);
    }
  }

  /**
   * Prepares schema by replacing callbacks with actionIds.
   * 
   * @internal
   */
  public prepareSectionedSchemaWithActionIds(sectioned: SettingsSections): SettingsSections {
    return {
      sections: sectioned.sections.map((sec: any, idx: number) => ({
        key: sec.key || sec.title || `section_${idx}`,
        name: sec.name,
        title: sec.title,
        disabled: sec.disabled,
        hidden: sec.hidden,
        expandable: sec.expandable,
        expanded: sec.expanded,
        components: (sec.components || []).map((comp: any) => {
          const newComp: any = { ...comp };
          if (newComp.type === 'button' && typeof newComp.onClick === 'function') {
            const actionId = `action_${newComp.key}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            this.actionCallbacks.set(actionId, newComp.onClick);
            newComp.actionId = actionId;
            delete newComp.onClick;
          }
          if (newComp.type !== 'button' && typeof newComp.onChange === 'function') {
            const changeId = `change_${newComp.key}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            this.actionCallbacks.set(changeId, newComp.onChange);
            newComp.onChangeActionId = changeId;
            delete newComp.onChange;
          }
          return newComp;
        })
      }))
    };
  }

  /**
   * Stores the latest sectioned schema for plugin settings.
   * 
   * @internal
   */
  public setSectionedSchema(schema: SettingsSections) {
    // Reset callbacks to avoid leaking stale handlers across schema updates
    this.actionCallbacks.clear();
    this.settingsSchema = this.prepareSectionedSchemaWithActionIds(schema);
  }

  /**
   * Stores action mappings and registers callbacks.
   * 
   * @internal
   */
  public setActionMappings(actions: ActionMappings): void {
    // Only reset callbacks for new registrations coming from slider actions
    // Keep existing settings callbacks intact by not clearing the entire map
    const prepared: ActionMappings = {
      buttons: (actions.buttons || []).map((btn) => {
        const copy: SystemUtilButton = { ...btn };
        if (typeof copy.onClick === 'function') {
          const actionId = `channel_action_${copy.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          this.actionCallbacks.set(actionId, copy.onClick);
          copy.actionId = actionId;
          delete (copy as any).onClick;
        }
        // Preserve per-channel selection map if provided
        if (btn.selectedByChannel && typeof btn.selectedByChannel === 'object') {
          copy.selectedByChannel = { ...btn.selectedByChannel } as Record<string, boolean>;
        }
        // Prepare per-button settings schema (register callbacks and replace with actionIds)
        if (btn.settings && (btn.settings as any).sections) {
          try {
            copy.settings = this.prepareSectionedSchemaWithActionIds(btn.settings as any);
          } catch (e) {
            console.warn('Failed to prepare button settings schema', e);
            copy.settings = btn.settings;
          }
        }
        return copy;
      })
    };
    this.actionMappings = prepared;
  }

}
