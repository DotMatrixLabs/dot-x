import type { RPCMessage, RPCError as RPCErrorType, RPCClient } from '../types/index.ts';

// Basic Socket.IO type definitions
interface SocketIOClient {
  emit(event: string, ...args: any[]): void;
  on(event: string, callback: (...args: any[]) => void): void;
  disconnect(): void;
}

interface SocketIOStatic {
  (url: string, options?: any): SocketIOClient;
}

declare const io: SocketIOStatic;

export class PluginRPCError extends Error {
  constructor(public rpcError: RPCErrorType) {
    super(rpcError.message);
    this.name = 'PluginRPCError';
  }
}

export class RPCClientImpl implements RPCClient {
  private socket: SocketIOClient | null = null;
  private messageId = 0;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }>();
  private subscriptions = new Map<string, Set<(params: any) => void>>();
  private isConnected = false;

  constructor(
    private serverUrl: string = 'http://localhost:8080',
    private pluginInfo?: { name: string; permissions: string[] }
  ) {
    this.connect();
  }

  /**
   * Connect to the RPC server
   */
  private connect(): void {
    this.socket = io(this.serverUrl, {
      path: '/plugin-rpc',
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    this.socket.on('connect', () => {
      console.log('Connected to RPC server');
      this.isConnected = true;
      this.registerPlugin();
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from RPC server');
      this.isConnected = false;
    });

    this.socket.on('rpc-message', (message: RPCMessage) => {
      this.handleMessage(message);
    });

    this.socket.on('connect_error', (error: any) => {
      console.error('Connection error:', error);
    });
  }

  /**
   * Register this plugin with the server
   */
  private registerPlugin(): void {
    if (this.socket && this.pluginInfo) {
      this.socket.emit('plugin-register', {
        name: this.pluginInfo.name,
        permissions: this.pluginInfo.permissions
      });
    }
  }

  /**
   * Send RPC request and wait for response
   */
  async request(method: string, params?: any): Promise<any> {
    if (!this.isConnected || !this.socket) {
      throw new Error('Not connected to RPC server');
    }

    const id = this.generateId();
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      const message: RPCMessage = {
        id,
        type: 'request',
        method,
        params
      };
      
      this.socket!.emit('rpc-message', message);
      
      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`RPC request timeout: ${method}`));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Send RPC notification (no response expected)
   */
  notify(method: string, params?: any): void {
    if (!this.isConnected || !this.socket) {
      console.warn('Cannot send notification, not connected to RPC server');
      return;
    }

    const message: RPCMessage = {
      id: this.generateId(),
      type: 'notification',
      method,
      params
    };
    
    this.socket.emit('rpc-message', message);
  }

  /**
   * Subscribe to RPC notifications
   */
  subscribe(method: string, callback: (params: any) => void): void {
    if (!this.subscriptions.has(method)) {
      this.subscriptions.set(method, new Set());
    }
    
    this.subscriptions.get(method)!.add(callback);
  }

  /**
   * Unsubscribe from RPC notifications
   */
  unsubscribe(method: string, callback: (params: any) => void): void {
    const callbacks = this.subscriptions.get(method);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.subscriptions.delete(method);
      }
    }
  }

  /**
   * Handle incoming RPC messages
   */
  handleMessage(message: RPCMessage): void {
    switch (message.type) {
      case 'response':
        this.handleResponse(message);
        break;
      case 'notification':
        this.handleNotification(message);
        break;
      default:
        console.warn('Unknown RPC message type:', message.type);
    }
  }

  private handleResponse(message: RPCMessage): void {
    const pending = this.pendingRequests.get(message.id);
    if (pending) {
      this.pendingRequests.delete(message.id);
      
      if (message.error) {
        pending.reject(new PluginRPCError(message.error));
      } else {
        pending.resolve(message.result);
      }
    }
  }

  private handleNotification(message: RPCMessage): void {
    if (message.method) {
      const callbacks = this.subscriptions.get(message.method);
      if (callbacks) {
        callbacks.forEach(callback => {
          try {
            callback(message.params);
          } catch (error) {
            console.error('Error in RPC notification callback:', error);
          }
        });
      }
    }
  }

  private generateId(): string {
    return `rpc_${Date.now()}_${++this.messageId}`;
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

/**
 * Create RPC client with Socket.IO transport
 */
export function createRPCClient(
  serverUrl?: string,
  pluginInfo?: { name: string; permissions: string[] }
): RPCClient {
  return new RPCClientImpl(serverUrl, pluginInfo);
} 