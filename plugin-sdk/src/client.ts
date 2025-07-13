import { io, Socket } from 'socket.io-client';

export class APIClient {
  private socket: Socket;
  private pendingRequests = new Map();
  
  constructor() {
    this.socket = io('http://localhost:3001');
    this.setupEventHandlers();
  }
  
  private setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('Connected to dot-x server');
    });
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from dot-x server');
    });
    
    this.socket.on('response', (data: any) => {
      const { id, result, error } = data;
      const pendingRequest = this.pendingRequests.get(id);
      
      if (pendingRequest) {
        this.pendingRequests.delete(id);
        if (error) {
          pendingRequest.reject(new Error(error));
        } else {
          pendingRequest.resolve(result);
        }
      }
    });
    
    this.socket.on('callback', (data: any) => {
      const { event, payload } = data;
      this.socket.emit('callback_handled', { event, payload });
    });
  }
  
  private setupCallback(event: string, callback: (...args: any[]) => void) {
    this.socket.on(event, callback);
  }
  
  private async call(method: string, params: any): Promise<any> {
    const id = Math.random().toString(36);
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      this.socket.emit('request', {
        id,
        method,
        params
      });
    });
  }
  
  get settings() {
    return {
      addButton: async (config: any) => {
        const result = await this.call('settings.addButton', config);
        
        return {
          id: result.id,
          onPress: (callback: () => void) => {
            // Setup callback listener
            this.setupCallback(`button.${result.id}.press`, callback);
          }
        };
      },
      
      addInput: async (config: any) => {
        const result = await this.call('settings.addInput', config);
        
        return {
          id: result.id,
          getValue: () => {
            // This would typically be implemented with a getter call
            return result.value || '';
          }
        };
      }
    };
  }
  
  get ui() {
    return {
      showNotification: async (message: string) => {
        return await this.call('ui.showNotification', { message });
      },
      
      openModal: async (content: string) => {
        return await this.call('ui.openModal', { content });
      }
    };
  }
}
