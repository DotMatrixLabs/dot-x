import type { RPCMessage, RPCError as RPCErrorType } from '../../plugin-sdk/types/index.ts';
import { io, Socket } from 'socket.io-client';
import { ref, reactive } from 'vue';

export interface ConnectedPlugin {
  id: string;
  name: string;
  socket: Socket;
  permissions: string[];
  commands: Map<string, any>;
}

export class PluginRPCServer {
  private plugins = reactive(new Map<string, ConnectedPlugin>());
  private messageHandlers = new Map<string, (pluginId: string, params: any) => any>();
  private serverSocket: Socket | null = null;
  private isConnected = ref(false);

  constructor(private serverUrl: string = 'http://localhost:8080') {
    this.setupServerConnection();
    this.registerDefaultHandlers();
  }

  /**
   * Setup Socket.IO server connection
   */
  private setupServerConnection(): void {
    this.serverSocket = io(this.serverUrl, {
      path: '/plugin-rpc',
      transports: ['websocket', 'polling']
    });

    this.serverSocket.on('connect', () => {
      console.log('RPC Server connected');
      this.isConnected.value = true;
    });

    this.serverSocket.on('disconnect', () => {
      console.log('RPC Server disconnected');
      this.isConnected.value = false;
    });

    this.serverSocket.on('plugin-connect', (pluginData) => {
      this.handlePluginConnection(pluginData);
    });

    this.serverSocket.on('plugin-disconnect', (pluginId) => {
      this.handlePluginDisconnection(pluginId);
    });

    this.serverSocket.on('rpc-message', (data) => {
      this.handleRPCMessage(data.pluginId, data.message);
    });
  }

  /**
   * Handle new plugin connection
   */
  private handlePluginConnection(pluginData: any): void {
    console.log('Plugin connected:', pluginData.name);
    
    const plugin: ConnectedPlugin = {
      id: pluginData.id,
      name: pluginData.name,
      socket: pluginData.socket,
      permissions: pluginData.permissions || [],
      commands: new Map()
    };

    this.plugins.set(pluginData.id, plugin);
    
    // Send connection confirmation
    this.sendToPlugin(pluginData.id, {
      id: 'connection-confirm',
      type: 'response',
      result: { status: 'connected', timestamp: Date.now() }
    });
  }

  /**
   * Handle plugin disconnection
   */
  private handlePluginDisconnection(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      console.log('Plugin disconnected:', plugin.name);
      
      // Clean up plugin commands
      plugin.commands.clear();
      
      // Remove from connected plugins
      this.plugins.delete(pluginId);
    }
  }

  /**
   * Handle incoming RPC messages from plugins
   */
  private async handleRPCMessage(pluginId: string, message: RPCMessage): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      console.error('Message from unknown plugin:', pluginId);
      return;
    }

    try {
      // Check permissions
      if (!this.hasPermission(plugin, message.method)) {
        this.sendErrorResponse(pluginId, message.id, {
          code: 'PERMISSION_DENIED',
          message: `Plugin ${plugin.name} does not have permission for ${message.method}`
        });
        return;
      }

      // Handle the message
      const handler = this.messageHandlers.get(message.method);
      if (handler) {
        const result = await handler(pluginId, message.params);
        
        // Send response for requests
        if (message.type === 'request') {
          this.sendResponse(pluginId, message.id, result);
        }
      } else {
        console.warn('No handler for RPC method:', message.method);
        
        if (message.type === 'request') {
          this.sendErrorResponse(pluginId, message.id, {
            code: 'METHOD_NOT_FOUND',
            message: `Method ${message.method} not found`
          });
        }
      }
    } catch (error) {
      console.error('Error handling RPC message:', error);
      
      if (message.type === 'request') {
        this.sendErrorResponse(pluginId, message.id, {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Register RPC method handler
   */
  registerHandler(method: string, handler: (pluginId: string, params: any) => any): void {
    this.messageHandlers.set(method, handler);
  }

  /**
   * Send response to plugin
   */
  private sendResponse(pluginId: string, messageId: string, result: any): void {
    this.sendToPlugin(pluginId, {
      id: messageId,
      type: 'response',
      result
    });
  }

  /**
   * Send error response to plugin
   */
  private sendErrorResponse(pluginId: string, messageId: string, error: RPCErrorType): void {
    this.sendToPlugin(pluginId, {
      id: messageId,
      type: 'response',
      error
    });
  }

  /**
   * Send notification to plugin
   */
  sendNotification(pluginId: string, method: string, params?: any): void {
    this.sendToPlugin(pluginId, {
      id: this.generateId(),
      type: 'notification',
      method,
      params
    });
  }

  /**
   * Broadcast notification to all plugins
   */
  broadcastNotification(method: string, params?: any): void {
    for (const pluginId of this.plugins.keys()) {
      this.sendNotification(pluginId, method, params);
    }
  }

  /**
   * Send message to specific plugin
   */
  private sendToPlugin(pluginId: string, message: RPCMessage): void {
    if (this.serverSocket) {
      this.serverSocket.emit('rpc-message', {
        pluginId,
        message
      });
    }
  }

  /**
   * Check if plugin has permission
   */
  private hasPermission(plugin: ConnectedPlugin, method: string): boolean {
    // Extract permission from method (e.g., "ui.actionSelector.addTab" -> "ui.actionSelector")
    const permissionParts = method.split('.');
    const basePermission = permissionParts.slice(0, 2).join('.');
    
    return plugin.permissions.includes(basePermission) || plugin.permissions.includes('*');
  }

  /**
   * Register default RPC handlers
   */
  private registerDefaultHandlers(): void {
    // UI ActionSelector handlers
    this.registerHandler('ui.actionSelector.addTab', (pluginId, params) => {
      console.log(`[${pluginId}] Adding ActionSelector tab:`, params);
      // TODO: Integrate with actual UI component
      return { success: true };
    });

    this.registerHandler('ui.actionSelector.removeTab', (pluginId, params) => {
      console.log(`[${pluginId}] Removing ActionSelector tab:`, params);
      // TODO: Integrate with actual UI component
      return { success: true };
    });

    // UI Settings handlers
    this.registerHandler('ui.settings.addTab', (pluginId, params) => {
      console.log(`[${pluginId}] Adding Settings tab:`, params);
      // TODO: Integrate with actual UI component
      return { success: true };
    });

    this.registerHandler('ui.settings.addInput', (pluginId, params) => {
      console.log(`[${pluginId}] Adding Settings input:`, params);
      // TODO: Integrate with actual UI component
      return { success: true };
    });

    // UI Commands handlers
    this.registerHandler('ui.commands.register', (pluginId, params) => {
      console.log(`[${pluginId}] Registering command:`, params);
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        plugin.commands.set(params.id, params);
      }
      return { success: true };
    });

    this.registerHandler('ui.commands.unregister', (pluginId, params) => {
      console.log(`[${pluginId}] Unregistering command:`, params);
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        plugin.commands.delete(params.id);
      }
      return { success: true };
    });

    // System RGB handlers
    this.registerHandler('system.rgb.setColor', (pluginId, params) => {
      console.log(`[${pluginId}] Setting RGB color:`, params);
      // TODO: Integrate with actual RGB system
      return { success: true };
    });

    this.registerHandler('system.rgb.getColor', (pluginId, params) => {
      console.log(`[${pluginId}] Getting RGB color:`, params);
      // TODO: Integrate with actual RGB system
      return { color: { r: 255, g: 0, b: 0 } };
    });

    this.registerHandler('system.rgb.setEffect', (pluginId, params) => {
      console.log(`[${pluginId}] Setting RGB effect:`, params);
      // TODO: Integrate with actual RGB system
      return { success: true };
    });

    // UI TopBar handlers
    this.registerHandler('ui.topBar.addButton', (pluginId, params) => {
      console.log(`[${pluginId}] Adding TopBar button:`, params);
      // TODO: Integrate with actual UI component
      return { success: true };
    });

    this.registerHandler('ui.topBar.removeButton', (pluginId, params) => {
      console.log(`[${pluginId}] Removing TopBar button:`, params);
      // TODO: Integrate with actual UI component
      return { success: true };
    });

    // UI Toasts handlers
    this.registerHandler('ui.toasts.show', (pluginId, params) => {
      console.log(`[${pluginId}] Showing toast:`, params);
      // TODO: Integrate with actual toast system
      return { success: true };
    });

    // Storage handlers
    this.registerHandler('storage.get', (pluginId, params) => {
      console.log(`[${pluginId}] Getting storage:`, params);
      // TODO: Integrate with actual storage system
      return { value: null };
    });

    this.registerHandler('storage.set', (pluginId, params) => {
      console.log(`[${pluginId}] Setting storage:`, params);
      // TODO: Integrate with actual storage system
      return { success: true };
    });

    // Modal handlers
    this.registerHandler('ui.modal.show', (pluginId, params) => {
      console.log(`[${pluginId}] Showing modal:`, params);
      // TODO: Integrate with actual modal system
      return { success: true };
    });

    this.registerHandler('ui.modal.hide', (pluginId, params) => {
      console.log(`[${pluginId}] Hiding modal:`, params);
      // TODO: Integrate with actual modal system
      return { success: true };
    });

    // Log handlers
    this.registerHandler('system.log.info', (pluginId, params) => {
      console.log(`[${pluginId}] INFO:`, params.message);
      return { success: true };
    });

    this.registerHandler('system.log.warn', (pluginId, params) => {
      console.warn(`[${pluginId}] WARN:`, params.message);
      return { success: true };
    });

    this.registerHandler('system.log.error', (pluginId, params) => {
      console.error(`[${pluginId}] ERROR:`, params.message);
      return { success: true };
    });
  }

  /**
   * Get connected plugins
   */
  getConnectedPlugins(): ConnectedPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId: string): ConnectedPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all commands from all plugins
   */
  getAllCommands(): Array<{ pluginId: string; command: any }> {
    const commands: Array<{ pluginId: string; command: any }> = [];
    
    for (const [pluginId, plugin] of this.plugins) {
      for (const command of plugin.commands.values()) {
        commands.push({ pluginId, command });
      }
    }
    
    return commands;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `rpc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const pluginRPCServer = new PluginRPCServer(); 