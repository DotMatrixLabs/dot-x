import { io, Socket } from 'socket.io-client';
import { FlatSettingsSchema, SettingsOptions, TabConfig, UIComponent, ModalButton } from './generated/types';

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
      createSettings: (params: {
        schema: FlatSettingsSchema;
        options?: SettingsOptions;
      }) => this.call('settings.createSettings', params),
      setValue: (params: {
        key: string;
        value: any;
      }) => this.call('settings.setValue', params),
      getValue: (params: {
        key: string;
      }) => this.call('settings.getValue', params),
      setVisibility: (params: {
        key: string;
        visible: boolean;
      }) => this.call('settings.setVisibility', params),
      setError: (params: {
        key: string;
        error: string | null;
      }) => this.call('settings.setError', params),
      setEnabled: (params: {
        key: string;
        enabled: boolean;
      }) => this.call('settings.setEnabled', params),
      setActiveTab: (params: {
        tabKey: string;
      }) => this.call('settings.setActiveTab', params),
      addTab: (params: {
        tabKey: string;
        config: TabConfig;
      }) => this.call('settings.addTab', params),
      removeTab: (params: {
        tabKey: string;
      }) => this.call('settings.removeTab', params),
      setTabVisibility: (params: {
        tabKey: string;
        visible: boolean;
      }) => this.call('settings.setTabVisibility', params),
      saveData: (params: {
        key: string;
        value: any;
      }) => this.call('settings.saveData', params),

    };
  }
  
  get ui() {
    return {
      showToast: (params: {
        message: string;
        type?: 'info' | 'success' | 'warning' | 'error';
        duration?: number;
      }) => this.call('ui.showToast', params),
      showModal: (params: {
        title: string;
        content: string | UIComponent;
        size?: 'small' | 'medium' | 'large' | 'fullscreen';
        buttons?: ModalButton[];
        closable?: boolean;
      }) => this.call('ui.showModal', params),  
      showConfirmation: (params: {
        title: string;
        message: string;
        confirmText?: string;
        cancelText?: string;
        type?: 'info' | 'warning' | 'danger';
      }) => this.call('ui.showConfirmation', params), 

    };
  }
}
