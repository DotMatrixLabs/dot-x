import { ref, reactive, onMounted, onUnmounted } from 'vue';
import type { ConnectedPlugin } from '../rpc/plugin-rpc-server';

// Basic Socket.IO client type definitions
interface SocketIOClient {
  emit(event: string, ...args: any[]): void;
  on(event: string, callback: (...args: any[]) => void): void;
  off(event: string, callback?: (...args: any[]) => void): void;
  disconnect(): void;
}

interface SocketIOStatic {
  (url: string, options?: any): SocketIOClient;
}

declare const io: SocketIOStatic;

export interface PluginUIAction {
  pluginId: string;
  action: string;
  params: any;
}

export interface PluginSystemAction {
  pluginId: string;
  action: string;
  params: any;
}

export interface PluginCommand {
  pluginId: string;
  command: {
    id: string;
    name: string;
    description?: string;
    hotkey?: string;
    icon?: string;
    callback: () => void;
  };
}

export function usePluginRPC() {
  const isConnected = ref(false);
  const connectedPlugins = reactive(new Map<string, ConnectedPlugin>());
  const pluginCommands = reactive(new Map<string, PluginCommand>());
  
  let socket: SocketIOClient | null = null;
  let connectionAttempts = 0;
  const maxConnectionAttempts = 5;
  
  // Event handlers
  const uiActionHandlers = new Map<string, (action: PluginUIAction) => void>();
  const systemActionHandlers = new Map<string, (action: PluginSystemAction) => void>();
  const commandHandlers = new Map<string, () => void>();

  const connect = () => {
    if (socket || connectionAttempts >= maxConnectionAttempts) return;
    
    connectionAttempts++;
    console.log(`Attempting to connect to Plugin RPC Server (attempt ${connectionAttempts})`);
    
    socket = io('http://localhost:8080', {
      path: '/plugin-rpc',
      transports: ['websocket', 'polling'],
      timeout: 5000,
      autoConnect: true
    });

    socket.on('connect', () => {
      console.log('Connected to Plugin RPC Server');
      isConnected.value = true;
      connectionAttempts = 0;
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from Plugin RPC Server');
      isConnected.value = false;
      
      // Try to reconnect after a delay
      setTimeout(() => {
        if (connectionAttempts < maxConnectionAttempts) {
          connect();
        }
      }, 2000);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      isConnected.value = false;
      
      // Try to reconnect after a delay
      setTimeout(() => {
        if (connectionAttempts < maxConnectionAttempts) {
          connect();
        }
      }, 2000);
    });

    // Handle plugin events
    socket.on('plugin-connected', (plugin: ConnectedPlugin) => {
      console.log('Plugin connected:', plugin.name);
      connectedPlugins.set(plugin.id, plugin);
    });

    socket.on('plugin-disconnected', (data: { pluginId: string }) => {
      console.log('Plugin disconnected:', data.pluginId);
      connectedPlugins.delete(data.pluginId);
      
      // Remove plugin commands
      for (const [commandId, command] of pluginCommands) {
        if (command.pluginId === data.pluginId) {
          pluginCommands.delete(commandId);
          commandHandlers.delete(commandId);
        }
      }
    });

    // Handle UI actions
    socket.on('ui-action', (action: PluginUIAction) => {
      console.log('UI Action:', action);
      const handler = uiActionHandlers.get(action.action);
      if (handler) {
        handler(action);
      }
    });

    // Handle system actions
    socket.on('system-action', (action: PluginSystemAction) => {
      console.log('System Action:', action);
      const handler = systemActionHandlers.get(action.action);
      if (handler) {
        handler(action);
      }
    });

    // Handle command registration
    socket.on('command-registered', (data: PluginCommand) => {
      console.log('Command registered:', data.command.name);
      pluginCommands.set(data.command.id, data);
      commandHandlers.set(data.command.id, data.command.callback);
    });

    // Handle command unregistration
    socket.on('command-unregistered', (data: { pluginId: string; commandId: string }) => {
      console.log('Command unregistered:', data.commandId);
      pluginCommands.delete(data.commandId);
      commandHandlers.delete(data.commandId);
    });
  };

  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      socket = null;
      isConnected.value = false;
    }
  };

  // Register UI action handlers
  const onUIAction = (action: string, handler: (action: PluginUIAction) => void) => {
    uiActionHandlers.set(action, handler);
  };

  // Register system action handlers
  const onSystemAction = (action: string, handler: (action: PluginSystemAction) => void) => {
    systemActionHandlers.set(action, handler);
  };

  // Execute a plugin command
  const executeCommand = (commandId: string) => {
    const handler = commandHandlers.get(commandId);
    if (handler) {
      try {
        handler();
      } catch (error) {
        console.error('Error executing command:', error);
      }
    }
  };

  // Send notification to all plugins
  const notifyAllPlugins = (method: string, params?: any) => {
    if (socket) {
      socket.emit('broadcast-notification', { method, params });
    }
  };

  // Send notification to specific plugin
  const notifyPlugin = (pluginId: string, method: string, params?: any) => {
    if (socket) {
      socket.emit('plugin-notification', { pluginId, method, params });
    }
  };

  // Get all commands
  const getAllCommands = () => {
    return Array.from(pluginCommands.values());
  };

  // Get plugins
  const getConnectedPlugins = () => {
    return Array.from(connectedPlugins.values());
  };

  // Auto-connect on mount
  onMounted(() => {
    connect();
  });

  // Disconnect on unmount
  onUnmounted(() => {
    disconnect();
  });

  return {
    isConnected,
    connectedPlugins,
    pluginCommands,
    connect,
    disconnect,
    onUIAction,
    onSystemAction,
    executeCommand,
    notifyAllPlugins,
    notifyPlugin,
    getAllCommands,
    getConnectedPlugins
  };
} 