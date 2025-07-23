import { io, Socket } from 'socket.io-client';
import { FlatSettingsSchema, SettingsOptions, TabConfig, UIComponent, ModalButton } from './generated/types';

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  connected_at: string;
}

export interface ApiRequest {
  method: string;
  params: any;
  request_id: string;
}

export interface ApiResponse {
  request_id: string;
  success: boolean;
  data?: any;
  error?: string;
}

export class APIClient {
  private socket: Socket;
  private isRegistered = false;
  private pluginInfo: PluginInfo;
  private registrationPromise: Promise<void>;
  private registrationResolve: ((value: void) => void) | null = null;
  private registrationReject: ((reason: any) => void) | null = null;
  
  constructor(pluginInfo: PluginInfo) {
    this.pluginInfo = pluginInfo;
    this.registrationPromise = new Promise((resolve, reject) => {
      this.registrationResolve = resolve;
      this.registrationReject = reject;
    });
    this.socket = io('http://localhost:3001');
    this.setupEventHandlers();
  }
  
  private setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('Connected to plugin server');
      this.register();
    });
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from plugin server');
      this.isRegistered = false;
    });
    
    this.socket.on('error', (error: any) => {
      console.error('Socket error:', error);
      if (this.registrationReject) {
        this.registrationReject(new Error(`Socket connection error: ${error.message || error}`));
        this.registrationReject = null;
      }
    });

    this.socket.on('connect_error', (error: any) => {
      console.error('Failed to connect to plugin server:', error);
      if (this.registrationReject) {
        this.registrationReject(new Error(`Failed to connect to plugin server: ${error.message || error}`));
        this.registrationReject = null;
      }
    });

    // Listen for events from frontend
    this.socket.on('frontend_event', (data: any) => {
      console.log('Received event from frontend:', data);
    });
    
    // Add a timeout for registration
    setTimeout(() => {
      if (!this.isRegistered && this.registrationReject) {
        this.registrationReject(new Error('Plugin registration timeout - server may not be running'));
        this.registrationReject = null;
      }
    }, 10000); // 10 second timeout
  }
  
  private register() {
    if (this.isRegistered) return;
    
    this.socket.emit('register', this.pluginInfo, (ack: any) => {
      console.log('Registration response:', ack);
      if (ack.status === 'success') {
        console.log('Plugin registered successfully!');
        this.isRegistered = true;
        if (this.registrationResolve) {
          this.registrationResolve();
          this.registrationResolve = null;
        }
              } else {
          console.error('Plugin registration failed:', ack);
          // Reject the registration promise on failure
          if (this.registrationReject) {
            this.registrationReject(new Error(`Plugin registration failed: ${ack.message || 'Unknown error'}`));
            this.registrationReject = null;
          }
        }
    });
  }
  
  private async call(method: string, params: any): Promise<any> {
    // Wait for registration to complete before making API calls
    await this.registrationPromise;
    
    if (!this.isRegistered) {
      throw new Error('Plugin registration failed');
    }
    
    const apiRequest: ApiRequest = {
      method,
      params,
      request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 30000);
      
      this.socket.emit('api_request', apiRequest, (response: ApiResponse) => {
        clearTimeout(timeout);
        
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error || 'API request failed'));
        }
      });
    });
  }
  
  public async waitForRegistration(): Promise<void> {
    await this.registrationPromise;
  }
  
  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
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
