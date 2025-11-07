// Simplified types for the new imperative settings builder
// Note: This file represents the public types used by the plugin SDK

export interface ToastParams {
  /** The message to display */
  message: string;
  /** Visual style of the toast (default: 'info') */
  type?: 'info' | 'success' | 'warning' | 'error';
  /** Auto-dismiss duration in milliseconds (default: 3000) */
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

export interface InputField extends BaseSettingsField {
  type: 'text' | 'password' | 'textarea' | 'color' | 'file' | 'number' | 'ip_address' | 'mac_address';
  onChange?: (data: { value: any }) => void;
  onChangeActionId?: string;
}

export interface ButtonField extends BaseSettingsField {
  type: 'button';
  text?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: () => void;
  actionId?: string;
}

export interface SwitchField extends BaseSettingsField {
  type: 'switch';
  onChange?: (data: { value: boolean }) => void;
  onChangeActionId?: string;
}

export interface SelectField extends BaseSettingsField {
  type: 'select';
  options: Array<{ value: any; label: string }>;
  onChange?: (data: { value: any }) => void;
  onChangeActionId?: string;
}

export interface TextField extends BaseSettingsField {
  type: 'text_display';
  text?: string;
  variant?: 'default' | 'muted' | 'info' | 'success' | 'warning' | 'error';
}

export interface BadgeField extends BaseSettingsField {
  type: 'badge';
  text?: string;
  variant?: 'default' | 'muted' | 'info' | 'success' | 'warning' | 'error';
}

export interface InfoField extends BaseSettingsField {
  type: 'info';
  text?: string;
  variant?: 'default' | 'info' | 'success' | 'warning' | 'error';
  showIcon?: boolean;
}

export type SettingsField = InputField | ButtonField | SwitchField | SelectField | TextField | BadgeField | InfoField;

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
  variant?: 'primary' | 'secondary' | 'danger';
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

// --- RGB Control Types ---

/**
 * Available RGB lighting effects for the Decker device.
 */
export type RGBEffect = 
  | 'rainbow'
  | 'static'
  | 'off'
  | 'lightningStorm'
  | 'candle'
  | 'perimeter'
  | 'breathing';

/**
 * RGB control options for setting LED effects.
 */
export interface RGBOptions {
  /** The lighting effect to apply */
  effect: RGBEffect;
  /** Animation speed (0-100) */
  speed: number;
  /** LED brightness (0-100) */
  brightness: number;
  /** Color in hex format (e.g., '#FF0000' for red) */
  color: string;
}

// --- Slider Action (System Utilities) Types ---
//TODO: Rename to Channel Action
export interface SystemUtilButton {
  id: string;            // Stable identifier (unique per plugin)
  title: string;         // Display title under the circular button
  icon?: string;         // Optional icon class (e.g., 'fas fa-bolt fa-lg')
  onClick?: (evt: { selected: boolean; channel: number | string }) => void;  // Callback provided by plugin; replaced with actionId by client
  actionId?: string;     // Runtime-assigned action id registered in the client
  // Per-channel selection map; keys are channel identifiers (usually slider indices)
  selectedByChannel?: Record<string, boolean>;
  // Optional per-button settings UI, reusing the same schema as plugin settings
  settings?: SettingsSections;
}

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