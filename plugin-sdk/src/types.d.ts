// Simplified types for the new imperative settings builder
// Note: This file represents the public types used by the plugin SDK

/**
 * Parameters for showing a toast notification.
 * 
 * @group Global UI
 */
export interface ToastParams {
  /** Message text to display */
  message: string;
  /** Notification type affecting visual style */
  type?: 'info' | 'success' | 'warning' | 'error';
  /** Duration in milliseconds before auto-dismiss */
  duration?: number;
}

/**
 * @internal
 * @group Advanced/Internal
 */
export interface ApiRequest {
  method: string;
  params: any;
  request_id: string;
}

/**
 * @internal
 * @group Advanced/Internal
 */
export interface ApiResponse {
  request_id: string;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Base properties shared by all settings fields.
 * 
 * @group Settings Page
 * @group Action Mapper Modal
 */
type BaseSettingsField = {
  label: string;
  section?: string;
  default?: any;
  placeholder?: string;
  required?: boolean;
  description?: string;
  disabled?: boolean;
};

/**
 * Configuration for an input field.
 * 
 * @group Settings Page
 * @group Action Mapper Modal
 */
export interface InputField extends BaseSettingsField {
  type: 'text' | 'password' | 'textarea' | 'color' | 'file' | 'number' | 'ip_address' | 'mac_address';
  onChange?: (data: { value: any }) => void;
  onChangeActionId?: string;
}

/**
 * Configuration for a button field.
 * 
 * @group Settings Page
 * @group Action Mapper Modal
 */
export interface ButtonField extends BaseSettingsField {
  type: 'button';
  text?: string;
  style?: 'primary' | 'secondary' | 'danger';
  onClick?: () => void;
  actionId?: string;
}

/**
 * Configuration for a switch/toggle field.
 * 
 * @group Settings Page
 * @group Action Mapper Modal
 */
export interface SwitchField extends BaseSettingsField {
  type: 'switch';
  onChange?: (data: { value: boolean }) => void;
  onChangeActionId?: string;
}

/**
 * Configuration for a select dropdown field.
 * 
 * @group Settings Page
 * @group Action Mapper Modal
 */
export interface SelectField extends BaseSettingsField {
  type: 'select';
  options: Array<{ value: any; label: string }>;
  onChange?: (data: { value: any }) => void;
  onChangeActionId?: string;
}

/**
 * Configuration for a read-only text display field.
 * 
 * @group Settings Page
 * @group Action Mapper Modal
 */
export interface TextField extends BaseSettingsField {
  type: 'text_display';
  text?: string;
  style?: 'default' | 'muted' | 'info' | 'success' | 'warning' | 'error';
}

/**
 * Configuration for a badge display field.
 * 
 * @group Settings Page
 * @group Action Mapper Modal
 */
export interface BadgeField extends BaseSettingsField {
  type: 'badge';
  text?: string;
  style?: 'default' | 'muted' | 'info' | 'success' | 'warning' | 'error';
}

/**
 * Union type of all settings field types.
 * 
 * @group Settings Page
 * @group Action Mapper Modal
 */
export type SettingsField = InputField | ButtonField | SwitchField | SelectField | TextField | BadgeField;

export type SettingsComponent = { key: string } & SettingsField;
export interface SettingsSection {
  // Required stable key to identify the section
  key: string;
  // Optional display name; when omitted, UI should not render a divider/title
  name?: string;
  // Back-compat for older schemas; UI should prefer `name` when present
  title?: string;
  // Section-level state/behavior flags
  disabled?: boolean;
  hidden?: boolean;
  // When true, render as an accordion/collapse
  expandable?: boolean;
  // Initial expanded state when expandable; default is collapsed (falsey)
  expanded?: boolean;
  components: SettingsComponent[];
}
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

  // Local persistent config storage helpers (scoped per plugin cwd)
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

/**
 * Configuration for a System Utilities action button.
 * 
 * These buttons appear in the action selector modal and can be assigned to
 * device channels (sliders, knobs, buttons). Each button maintains its own
 * selected state per channel.
 * 
 * @group Action Mapper Modal
 */
export interface SystemUtilButton {
  /** Unique identifier for the button */
  id: string;
  /** Display title shown under the button */
  title: string;
  /** Optional FontAwesome icon class (e.g., 'fas fa-bolt fa-lg') */
  icon?: string;
  /** Callback when button is clicked/toggled */
  onClick?: (evt: { selected: boolean; channel: number | string }) => void;
  /** Runtime-assigned action ID (internal use) */
  actionId?: string;
  /** Per-channel selection state map */
  selectedByChannel?: Record<string, boolean>;
  /** Optional per-button settings UI */
  settings?: SettingsSections;
}

/**
 * Collection of action button mappings.
 * 
 * @group Action Mapper Modal
 */
export interface ActionMappings {
  buttons: SystemUtilButton[];
}

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