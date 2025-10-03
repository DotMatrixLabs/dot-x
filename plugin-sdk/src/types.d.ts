// Simplified types for the new imperative settings builder
// Note: This file represents the public types used by the plugin SDK

export interface ToastParams {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
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

type BaseSettingsField = {
  label: string;
  section?: string;
  default?: any;
  placeholder?: string;
  required?: boolean;
  description?: string;
  disabled?: boolean;
};

export interface TextField extends BaseSettingsField {
  type: 'text' | 'password' | 'textarea' | 'color' | 'file' | 'number';
  onChange?: (value: any) => void;
  onChangeActionId?: string;
}

export interface ButtonField extends BaseSettingsField {
  type: 'button';
  text?: string;
  style?: 'primary' | 'secondary' | 'danger';
  onClick?: () => void;
  actionId?: string;
}

export type SettingsField = TextField | ButtonField;

export type SettingsComponent = { key: string } & SettingsField;
export interface SettingsSection { title: string; components: SettingsComponent[] }
export interface SettingsSections { sections: SettingsSection[] }

export interface PluginSettingsResponse {
  success: boolean;
  settingsId: string;
  error?: string;
}

export interface UIComponent {
  type: string;
  props?: Record<string, any>;
  children?: UIComponent[];
}

export interface ModalButton {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export interface ModalResult {
  button?: string;
  data?: any;
  cancelled: boolean;
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  status: 'active' | 'inactive' | 'error';
  lastError?: string;
}

export interface PluginConfig {
  enabled: boolean;
  autoStart: boolean;
  permissions: string[];
  resources: {
    maxMemory?: number;
    maxCpu?: number;
  };
}

export interface APIError {
  code: string;
  message: string;
  details?: any;
}

export interface PluginContext {
  pluginId: string;
  pluginDir: string;
}

export interface CreateSettingsParams {
  schema: SettingsSections;
}

export interface PluginAPI {
  // Settings Management
  settings: {
    // Create settings instance (called by plugin developers)
    createSettings: (params: CreateSettingsParams) => Promise<PluginSettingsResponse>;
  };

  // UI Components
  ui: {
    showToast: (params: ToastParams) => Promise<void>;
    
    showModal: (params: {
      title: string;
      content: string | UIComponent;
      size?: 'small' | 'medium' | 'large' | 'fullscreen';
      buttons?: ModalButton[];
      closable?: boolean;
    }) => Promise<ModalResult>;
    
    showConfirmation: (params: {
      title: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
      type?: 'info' | 'warning' | 'danger';
    }) => Promise<boolean>;
  };

  // Plugin Management (pluginId automatically injected)
  plugin: {
    // getInfo: () => Promise<PluginInfo>;
    
    // setStatus: (params: {
    //   status: 'active' | 'inactive' | 'error';
    //   message?: string;
    // }) => Promise<void>;
    
    // getConfig: () => Promise<PluginConfig>;
    
    // updateConfig: (params: {
    //   config: Partial<PluginConfig>;
    // }) => Promise<void>;
    
    // getManifest: () => Promise<PluginManifest>;
  };

  // System Integration
  system: {
    // getVersion: () => Promise<string>;
    
    // getTheme: () => Promise<'light' | 'dark'>;
    
    // getLanguage: () => Promise<string>;

    subscribe: (params: {
      event: SystemEvent;
      callback: (data: any) => void;
    }) => Promise<string>; // returns subscription ID
    
    unsubscribe: (params: {
      subscriptionId: string;
    }) => Promise<void>;
  };

  // Events (pub/sub system)
  events: {
    emit: (params: {
      event: string;
      data?: any;
    }) => Promise<void>;
    
    on: (params: {
      event: string;
      callback: (data: any) => void;
    }) => Promise<string>; // returns listener ID
    
    off: (params: {
      listenerId: string;
    }) => Promise<void>;
    
    once: (params: {
      event: string;
      callback: (data: any) => void;
    }) => Promise<void>;
    
    sliderChange: (params: {
      pluginId: string;
      callback: (data: any) => void;
    }) => Promise<void>;

    deviceDisconnected: (params: {
      pluginId: string;
      callback: (data: any) => void;
    }) => Promise<void>;

    deviceConnected: (params: {
      pluginId: string;
      callback: (data: any) => void;
    }) => Promise<void>;
  };
}

export type SystemEvent = 
  | 'theme-changed'
  | 'language-changed'
  | 'app-ready'
  | 'app-closing'
  | 'plugin-loaded'
  | 'plugin-unloaded'
  | 'settings-changed';

export interface APIClientInterface extends PluginAPI {
  // Extended client interface for internal use
}


// Additional types specific to the plugin SDK
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

declare module './generated/types' {
  interface PluginAPI {
    config: {
      set: (key: string | Record<string, any>, value?: any) => void;
      get: <T = any>(key: string, defaultValue?: T) => T | undefined;
      delete: (key: string) => void;
      clear: () => void;
      has: (key: string) => boolean;
      all: () => Record<string, any>;
      path: () => string;
      init: (options?: { schema?: Record<string, any>; defaults?: Record<string, any> }) => void;
    };
  }
}