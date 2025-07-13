import { Server } from 'socket.io';
import { createServer } from 'http';
import type { RPCMessage, RPCError as RPCErrorType } from '../../plugin-sdk/types/index.ts';

export interface ConnectedPlugin {
  id: string;
  name: string;
  socket: any;
  permissions: string[];
  commands: Map<string, any>;
  lastSeen: number;
}

export class PluginRPCServer {
  private io: Server;
  private httpServer: any;
  private plugins = new Map<string, ConnectedPlugin>();
  private messageHandlers = new Map<string, (pluginId: string, params: any) => any>();
  private frontendCallbacks = new Map<string, (data: any) => void>();

  constructor(private port: number = 8080) {
    this.httpServer = createServer();
    this.io = new Server(this.httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      path: '/plugin-rpc'
    });

    this.setupSocketHandlers();
    this.registerDefaultHandlers();
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.port, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          console.log(`Plugin RPC Server running on port ${this.port}`);
          resolve();
        }
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.close(() => {
        console.log('Plugin RPC Server stopped');
        resolve();
      });
    });
  }

  // Register callbacks for frontend integration
  onFrontendEvent(event: string, callback: (data: any) => void): void {
    this.frontendCallbacks.set(event, callback);
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log('New connection:', socket.id);

      // Handle plugin registration
      socket.on('plugin-register', (pluginData) => {
        this.handlePluginRegistration(socket, pluginData);
      });

      // Handle RPC messages
      socket.on('rpc-message', (message: RPCMessage) => {
        this.handleRPCMessage(socket.id, message);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handlePluginDisconnection(socket.id);
      });
    });
  }

  private handlePluginRegistration(socket: any, pluginData: any): void {
    console.log('Plugin registered:', pluginData.name);
    
    const plugin: ConnectedPlugin = {
      id: socket.id,
      name: pluginData.name,
      socket,
      permissions: pluginData.permissions || [],
      commands: new Map(),
      lastSeen: Date.now()
    };

    this.plugins.set(socket.id, plugin);
    
    // Send registration confirmation
    socket.emit('rpc-message', {
      id: 'registration-confirm',
      type: 'response',
      result: { status: 'registered', pluginId: socket.id }
    });

    // Notify frontend
    this.notifyFrontend('plugin-connected', plugin);
  }

  private handlePluginDisconnection(socketId: string): void {
    const plugin = this.plugins.get(socketId);
    if (plugin) {
      console.log('Plugin disconnected:', plugin.name);
      
      // Clean up plugin commands
      plugin.commands.clear();
      
      // Remove from connected plugins
      this.plugins.delete(socketId);

      // Notify frontend
      this.notifyFrontend('plugin-disconnected', { pluginId: socketId });
    }
  }

  private async handleRPCMessage(socketId: string, message: RPCMessage): Promise<void> {
    const plugin = this.plugins.get(socketId);
    if (!plugin) {
      console.error('Message from unknown plugin:', socketId);
      return;
    }

    plugin.lastSeen = Date.now();

    try {
      // Check permissions
      if (!this.hasPermission(plugin, message.method)) {
        this.sendErrorResponse(socketId, message.id, {
          code: 'PERMISSION_DENIED',
          message: `Plugin ${plugin.name} does not have permission for ${message.method}`
        });
        return;
      }

      // Handle the message
      const handler = this.messageHandlers.get(message.method);
      if (handler) {
        const result = await handler(socketId, message.params);
        
        // Send response for requests
        if (message.type === 'request') {
          this.sendResponse(socketId, message.id, result);
        }
      } else {
        console.warn('No handler for RPC method:', message.method);
        
        if (message.type === 'request') {
          this.sendErrorResponse(socketId, message.id, {
            code: 'METHOD_NOT_FOUND',
            message: `Method ${message.method} not found`
          });
        }
      }
    } catch (error) {
      console.error('Error handling RPC message:', error);
      
      if (message.type === 'request') {
        this.sendErrorResponse(socketId, message.id, {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  registerHandler(method: string, handler: (pluginId: string, params: any) => any): void {
    this.messageHandlers.set(method, handler);
  }

  private sendResponse(socketId: string, messageId: string, result: any): void {
    const plugin = this.plugins.get(socketId);
    if (plugin) {
      plugin.socket.emit('rpc-message', {
        id: messageId,
        type: 'response',
        result
      });
    }
  }

  private sendErrorResponse(socketId: string, messageId: string, error: RPCErrorType): void {
    const plugin = this.plugins.get(socketId);
    if (plugin) {
      plugin.socket.emit('rpc-message', {
        id: messageId,
        type: 'response',
        error
      });
    }
  }

  sendNotification(socketId: string, method: string, params?: any): void {
    const plugin = this.plugins.get(socketId);
    if (plugin) {
      plugin.socket.emit('rpc-message', {
        id: this.generateId(),
        type: 'notification',
        method,
        params
      });
    }
  }

  broadcastNotification(method: string, params?: any): void {
    for (const socketId of this.plugins.keys()) {
      this.sendNotification(socketId, method, params);
    }
  }

  private hasPermission(plugin: ConnectedPlugin, method: string): boolean {
    // Extract permission from method (e.g., "ui.actionSelector.addTab" -> "ui.actionSelector")
    const permissionParts = method.split('.');
    const basePermission = permissionParts.slice(0, 2).join('.');
    
    return plugin.permissions.includes(basePermission) || plugin.permissions.includes('*');
  }

  private notifyFrontend(event: string, data: any): void {
    const callback = this.frontendCallbacks.get(event);
    if (callback) {
      callback(data);
    }
  }

  private registerDefaultHandlers(): void {
    // UI ActionSelector handlers
    this.registerHandler('ui.actionSelector.addTab', (pluginId, params) => {
      console.log(`[${pluginId}] Adding ActionSelector tab:`, params);
      this.notifyFrontend('ui-action', {
        pluginId,
        action: 'actionSelector.addTab',
        params
      });
      return { success: true };
    });

    this.registerHandler('ui.actionSelector.removeTab', (pluginId, params) => {
      console.log(`[${pluginId}] Removing ActionSelector tab:`, params);
      this.notifyFrontend('ui-action', {
        pluginId,
        action: 'actionSelector.removeTab',
        params
      });
      return { success: true };
    });

    // UI Settings handlers
    this.registerHandler('ui.settings.addTab', (pluginId, params) => {
      console.log(`[${pluginId}] Adding Settings tab:`, params);
      this.notifyFrontend('ui-action', {
        pluginId,
        action: 'settings.addTab',
        params
      });
      return { success: true };
    });

    this.registerHandler('ui.settings.addInput', (pluginId, params) => {
      console.log(`[${pluginId}] Adding Settings input:`, params);
      this.notifyFrontend('ui-action', {
        pluginId,
        action: 'settings.addInput',
        params
      });
      return { success: true };
    });

    // UI Commands handlers
    this.registerHandler('ui.commands.register', (pluginId, params) => {
      console.log(`[${pluginId}] Registering command:`, params);
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        plugin.commands.set(params.id, params);
      }
      this.notifyFrontend('command-registered', {
        pluginId,
        command: params
      });
      return { success: true };
    });

    this.registerHandler('ui.commands.unregister', (pluginId, params) => {
      console.log(`[${pluginId}] Unregistering command:`, params);
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        plugin.commands.delete(params.id);
      }
      this.notifyFrontend('command-unregistered', {
        pluginId,
        commandId: params.id
      });
      return { success: true };
    });

    // System RGB handlers
    this.registerHandler('system.rgb.setColor', (pluginId, params) => {
      console.log(`[${pluginId}] Setting RGB color:`, params);
      this.notifyFrontend('system-action', {
        pluginId,
        action: 'rgb.setColor',
        params
      });
      return { success: true };
    });

    this.registerHandler('system.rgb.getColor', (pluginId, params) => {
      console.log(`[${pluginId}] Getting RGB color:`, params);
      // TODO: Get actual RGB color from system
      return { color: { r: 255, g: 0, b: 0 } };
    });

    this.registerHandler('system.rgb.setEffect', (pluginId, params) => {
      console.log(`[${pluginId}] Setting RGB effect:`, params);
      this.notifyFrontend('system-action', {
        pluginId,
        action: 'rgb.setEffect',
        params
      });
      return { success: true };
    });

    // UI TopBar handlers
    this.registerHandler('ui.topBar.addButton', (pluginId, params) => {
      console.log(`[${pluginId}] Adding TopBar button:`, params);
      this.notifyFrontend('ui-action', {
        pluginId,
        action: 'topBar.addButton',
        params
      });
      return { success: true };
    });

    this.registerHandler('ui.topBar.removeButton', (pluginId, params) => {
      console.log(`[${pluginId}] Removing TopBar button:`, params);
      this.notifyFrontend('ui-action', {
        pluginId,
        action: 'topBar.removeButton',
        params
      });
      return { success: true };
    });

    // UI Toasts handlers
    this.registerHandler('ui.toasts.show', (pluginId, params) => {
      console.log(`[${pluginId}] Showing toast:`, params);
      this.notifyFrontend('ui-action', {
        pluginId,
        action: 'toasts.show',
        params
      });
      return { success: true };
    });

    // Storage handlers
    this.registerHandler('storage.get', (pluginId, params) => {
      console.log(`[${pluginId}] Getting storage:`, params);
      // TODO: Implement actual storage
      return { value: null };
    });

    this.registerHandler('storage.set', (pluginId, params) => {
      console.log(`[${pluginId}] Setting storage:`, params);
      // TODO: Implement actual storage
      return { success: true };
    });

    // Modal handlers
    this.registerHandler('ui.modal.show', (pluginId, params) => {
      console.log(`[${pluginId}] Showing modal:`, params);
      this.notifyFrontend('ui-action', {
        pluginId,
        action: 'modal.show',
        params
      });
      return { success: true };
    });

    this.registerHandler('ui.modal.hide', (pluginId, params) => {
      console.log(`[${pluginId}] Hiding modal:`, params);
      this.notifyFrontend('ui-action', {
        pluginId,
        action: 'modal.hide',
        params
      });
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

  getConnectedPlugins(): ConnectedPlugin[] {
    return Array.from(this.plugins.values());
  }

  getPlugin(pluginId: string): ConnectedPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  getAllCommands(): Array<{ pluginId: string; command: any }> {
    const commands: Array<{ pluginId: string; command: any }> = [];
    
    for (const [pluginId, plugin] of this.plugins) {
      for (const command of plugin.commands.values()) {
        commands.push({ pluginId, command });
      }
    }
    
    return commands;
  }

  private generateId(): string {
    return `rpc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create and start the server
const server = new PluginRPCServer(8080);
server.start().then(() => {
  console.log('Plugin RPC Server started successfully');
}).catch((error) => {
  console.error('Failed to start Plugin RPC Server:', error);
});

export default server; 