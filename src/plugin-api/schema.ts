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

interface BaseSettingsField {
  label: string;
  tab?: string;
  section?: string;
  default?: any;
  placeholder?: string;
  required?: boolean;
  description?: string;
  help?: string;
}

export interface TextField extends BaseSettingsField {
  type: 'text' | 'password' | 'textarea' | 'color' | 'file' | 'number';
  options?: never;
}

export interface BooleanField extends BaseSettingsField {
  type: 'boolean';
  options?: never;
}

export interface SelectField extends BaseSettingsField {
  type: 'select';
  options: Array<{ value: any; label: string }>;
}

export interface ButtonField extends BaseSettingsField {
  type: 'button';
  text?: string;
  style?: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
  actionId?: string;
}

export type SettingsField =
  | TextField
  | BooleanField
  | SelectField
  | ButtonField;

export type SettingsSchema = Record<string, SettingsField>;

export interface TabConfig {
  title: string;
  icon?: string;
  description?: string;
  order?: number;
  visible?: boolean;
  condition?: () => boolean;
  badge?: string | number | (() => string | number);
  color?: string;
  onClick?: () => void;
}

export interface TabConfiguration {
  [key: string]: TabConfig;
}

export interface SettingsOptions {
  tabs?: TabConfiguration;
  defaultTab?: string;
  showTabIcons?: boolean;
  tabPosition?: 'top' | 'left' | 'right';
  autoSave?: boolean;
  validateOnChange?: boolean;
}

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

export type SystemEvent = 
  | 'theme-changed'
  | 'language-changed'
  | 'app-ready'
  | 'app-closing'
  | 'plugin-loaded'
  | 'plugin-unloaded'
  | 'settings-changed';

export interface CreateSettingsParams {
  schema: SettingsSchema;
  options?: SettingsOptions;
}

export type ChannelTarget = string;

export type ChannelTargetsByChannel = Record<string, ChannelTarget[]>;

export interface ChannelTargetsForChannelResponse {
  channel: string;
  targets: ChannelTarget[];
}

export interface ChannelTargetsAllResponse {
  channels: ChannelTargetsByChannel;
}

export interface PluginAPI {
  // Settings Management
  settings: {
    // Create settings instance (called by plugin developers)
    createSettings: (params: CreateSettingsParams) => Promise<PluginSettingsResponse>;
    
    // Internal methods (pluginId injected automatically)
    setValue: (params: {
      key: string;
      value: any;
    }) => Promise<void>;
    
    getValue: (params: {
      key: string;
    }) => Promise<any>;
    
    setVisibility: (params: {
      key: string;
      visible: boolean;
    }) => Promise<void>;
    
    setError: (params: {
      key: string;
      error: string | null;
    }) => Promise<void>;
    
    setEnabled: (params: {
      key: string;
      enabled: boolean;
    }) => Promise<void>;
    
    setActiveTab: (params: {
      tabKey: string;
    }) => Promise<void>;
    
    addTab: (params: {
      tabKey: string;
      config: TabConfig;
    }) => Promise<void>;
    
    removeTab: (params: {
      tabKey: string;
    }) => Promise<void>;
    
    setTabVisibility: (params: {
      tabKey: string;
      visible: boolean;
    }) => Promise<void>;

    saveData: (params: {
      key: string;
      value: any;
    }) => Promise<void>;
  };

  // UI Components
  ui: {
    showToast: (params: {
      message: string;
      type?: 'info' | 'success' | 'warning' | 'error';
      duration?: number;
    }) => Promise<void>;


  };

  // Channel Targets
  channelTargets: {
    getForChannel: (params: {
      channel: number | string;
    }) => Promise<ChannelTargetsForChannelResponse>;

    getAll: () => Promise<ChannelTargetsAllResponse>;
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
