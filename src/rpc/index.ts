import { ref, reactive } from 'vue';
import { io, Socket } from 'socket.io-client';
import type { RPCMessage, RPCError as RPCErrorType } from '../../plugin-sdk/types/index.ts';

export interface ConnectedPlugin {
  id: string;
  name: string;
  permissions: string[];
  commands: Map<string, any>;
  lastSeen: number;
}

export interface PluginRPCHandler {
  connect(): void;
  disconnect(): void;
  getConnectedPlugins(): ConnectedPlugin[];
  broadcastNotification(method: string, params?: any): void;
  registerUIHandler(method: string, handler: (pluginId: string, params: any) => any): void;
}

class PluginRPCHandlerImpl implements PluginRPCHandler {
  private socket: Socket | null = null;
  private plugins = reactive(new Map<string, ConnectedPlugin>());
  private messageHandlers = new Map<string, (pluginId: string, params: any) => any>();
  private isConnected = ref(false);
  private serverUrl = 'http://localhost:8080';

  constructor() {
    this.setupDefaultHandlers();
  }

  connect(): void {
    if (this.socket) {
      return;
    }

    this.socket = io(this.serverUrl, {
      path: '/plugin-rpc',
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    this.socket.on('connect', () => {
      console.log('Connected to plugin RPC server');
      this.isConnected.value = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from plugin RPC server');
      this.isConnected.value = false;
    });

    this.socket.on('plugin-connected', (pluginData) => {
      this.handlePluginConnection(pluginData);
    });

    this.socket.on('plugin-disconnected', (pluginId) => {
      this.handlePluginDisconnection(pluginId);
    });

    this.socket.on('plugin-rpc-message', (data) => {
      this.handleRPCMessage(data.pluginId, data.message);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected.value = false;
    }
  }

  private handlePluginConnection(pluginData: any): void {
    console.log('Plugin connected:', pluginData.name);
    
    const plugin: ConnectedPlugin = {
      id: pluginData.id,
      name: pluginData.name,
      permissions: pluginData.permissions || [],
      commands: new Map(),
      lastSeen: Date.now()
    };

    this.plugins.set(pluginData.id, plugin);
  }

  private handlePluginDisconnection(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      console.log('Plugin disconnected:', plugin.name);
      plugin.commands.clear();
      this.plugins.delete(pluginId);
    }
  }

  private async handleRPCMessage(pluginId: string, message: RPCMessage): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      console.error('Message from unknown plugin:', pluginId);
      return;
    }

    plugin.lastSeen = Date.now();

    try {
      const handler = this.messageHandlers.get(message.method);
      if (handler) {
        const result = await handler(pluginId, message.params);
        
        // Send response back to plugin server
        if (message.type === 'request' && this.socket) {
          this.socket.emit('rpc-response', {
            pluginId,
            messageId: message.id,
            result
          });
        }
      } else {
        console.warn('No handler for RPC method:', message.method);
        
        if (message.type === 'request' && this.socket) {
          this.socket.emit('rpc-error', {
            pluginId,
            messageId: message.id,
            error: {
              code: 'METHOD_NOT_FOUND',
              message: `Method ${message.method} not found`
            }
          });
        }
      }
    } catch (error) {
      console.error('Error handling RPC message:', error);
      
      if (message.type === 'request' && this.socket) {
        this.socket.emit('rpc-error', {
          pluginId,
          messageId: message.id,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    }
  }

  registerUIHandler(method: string, handler: (pluginId: string, params: any) => any): void {
    this.messageHandlers.set(method, handler);
  }

  getConnectedPlugins(): ConnectedPlugin[] {
    return Array.from(this.plugins.values());
  }

  broadcastNotification(method: string, params?: any): void {
    if (this.socket) {
      this.socket.emit('broadcast-notification', {
        method,
        params
      });
    }
  }

  private setupDefaultHandlers(): void {
    // UI ActionSelector handlers
    this.registerUIHandler('ui.actionSelector.addTab', (pluginId, params) => {
      console.log(`[${pluginId}] Adding ActionSelector tab:`, params);
      // TODO: Integrate with actual ActionSelector component
      return { success: true };
    });

    this.registerUIHandler('ui.actionSelector.removeTab', (pluginId, params) => {
      console.log(`[${pluginId}] Removing ActionSelector tab:`, params);
      // TODO: Integrate with actual ActionSelector component
      return { success: true };
    });

    // UI Settings handlers
    this.registerUIHandler('ui.settings.addTab', (pluginId, params) => {
      console.log(`[${pluginId}] Adding Settings tab:`, params);
      // TODO: Integrate with actual Settings component
      return { success: true };
    });

    this.registerUIHandler('ui.settings.addInput', (pluginId, params) => {
      console.log(`[${pluginId}] Adding Settings input:`, params);
      // TODO: Integrate with actual Settings component
      return { success: true };
    });

    // UI Commands handlers
    this.registerUIHandler('ui.commands.register', (pluginId, params) => {
      console.log(`[${pluginId}] Registering command:`, params);
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        plugin.commands.set(params.id, params);
      }
      return { success: true };
    });

    this.registerUIHandler('ui.commands.unregister', (pluginId, params) => {
      console.log(`[${pluginId}] Unregistering command:`, params);
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        plugin.commands.delete(params.id);
      }
      return { success: true };
    });

    // System RGB handlers
    this.registerUIHandler('system.rgb.setColor', (pluginId, params) => {
      console.log(`[${pluginId}] Setting RGB color:`, params);
      // TODO: Integrate with actual RGB system
      return { success: true };
    });

    this.registerUIHandler('system.rgb.getColor', (pluginId, params) => {
      console.log(`[${pluginId}] Getting RGB color:`, params);
      // TODO: Get actual RGB color from system
      return { color: { r: 255, g: 0, b: 0 } };
    });

    this.registerUIHandler('system.rgb.setEffect', (pluginId, params) => {
      console.log(`[${pluginId}] Setting RGB effect:`, params);
      // TODO: Integrate with actual RGB system
      return { success: true };
    });

    // UI TopBar handlers
    this.registerUIHandler('ui.topBar.addButton', (pluginId, params) => {
      console.log(`[${pluginId}] Adding TopBar button:`, params);
      // TODO: Integrate with actual TopBar component
      return { success: true };
    });

    this.registerUIHandler('ui.topBar.removeButton', (pluginId, params) => {
      console.log(`[${pluginId}] Removing TopBar button:`, params);
      // TODO: Integrate with actual TopBar component
      return { success: true };
    });

    // UI Toasts handlers
    this.registerUIHandler('ui.toasts.show', (pluginId, params) => {
      console.log(`[${pluginId}] Showing toast:`, params);
      // TODO: Integrate with actual toast system
      return { success: true };
    });

    // Storage handlers
    this.registerUIHandler('storage.get', (pluginId, params) => {
      console.log(`[${pluginId}] Getting storage:`, params);
      // TODO: Implement actual storage
      return { value: null };
    });

    this.registerUIHandler('storage.set', (pluginId, params) => {
      console.log(`[${pluginId}] Setting storage:`, params);
      // TODO: Implement actual storage
      return { success: true };
    });

    // Modal handlers
    this.registerUIHandler('ui.modal.show', (pluginId, params) => {
      console.log(`[${pluginId}] Showing modal:`, params);
      // TODO: Integrate with actual modal system
      return { success: true };
    });

    this.registerUIHandler('ui.modal.hide', (pluginId, params) => {
      console.log(`[${pluginId}] Hiding modal:`, params);
      // TODO: Integrate with actual modal system
      return { success: true };
    });

    // Log handlers
    this.registerUIHandler('system.log.info', (pluginId, params) => {
      console.log(`[${pluginId}] INFO:`, params.message);
      return { success: true };
    });

    this.registerUIHandler('system.log.warn', (pluginId, params) => {
      console.warn(`[${pluginId}] WARN:`, params.message);
      return { success: true };
    });

    this.registerUIHandler('system.log.error', (pluginId, params) => {
      console.error(`[${pluginId}] ERROR:`, params.message);
      return { success: true };
    });
  }
}

// Export singleton instance
export const pluginRPCHandler = new PluginRPCHandlerImpl(); 