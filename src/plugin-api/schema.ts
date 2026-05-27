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

export interface ToastParams {
  /** The message to display. */
  message: string;
  /** Visual style of the toast. Defaults to "info". */
  type?: 'info' | 'success' | 'warning' | 'error';
  /** Auto-dismiss duration in milliseconds. Defaults to 3000. */
  duration?: number;
}

export interface PluginConfigStore {
  set: (key: string | Record<string, any>, value?: any) => void;
  get: <T = any>(key: string, defaultValue?: T) => T | undefined;
  delete: (key: string) => void;
  clear: () => void;
  has: (key: string) => boolean;
  all: () => Record<string, any>;
  path: () => string;
  init: (options?: {
    schema?: Record<string, any>;
    defaults?: Record<string, any>;
  }) => void;
}

export interface BaseSettingsField {
  label: string;
  section?: string;
  default?: any;
  placeholder?: string;
  required?: boolean;
  description?: string;
  disabled?: boolean;
}

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

export type SettingsField =
  | InputField
  | ButtonField
  | SwitchField
  | SelectField
  | TextField
  | BadgeField
  | InfoField;

export type SettingsComponent = { key: string } & SettingsField;

export interface SettingsSection {
  key: string;
  name?: string;
  title?: string;
  disabled?: boolean;
  hidden?: boolean;
  expandable?: boolean;
  expanded?: boolean;
  components: SettingsComponent[];
}

export interface SettingsSections {
  sections: SettingsSection[];
}

export interface DeviceInfo {
  name: string;
  port: string;
  state: 'connected' | 'disconnected';
  connected_at?: string;
}

export interface DeviceChanges {
  changes: Array<{ index: number; oldValue: number; newValue: number }>;
  values: Array<{ value: number }>;
}

export type DeviceConnectionCallback = (device: DeviceInfo) => void | Promise<void>;

export type DeviceUpdateCallback = (data: DeviceChanges) => void | Promise<void>;

export type RGBEffect =
  | 'rainbow'
  | 'static'
  | 'off'
  | 'lightningStorm'
  | 'candle'
  | 'perimeter'
  | 'breathing';

export interface RGBState {
  effect: RGBEffect;
  speed: number;
  brightness: number;
  color: string;
}

export interface RGBOptions {
  effect: RGBEffect;
  speed: number;
  brightness: number;
  color: string;
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

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  connected_at?: string;
  author?: string;
  description?: string;
  sdkVersion?: string;
  hostApiVersion?: string;
  capabilities?: string[];
  status?: 'active' | 'inactive' | 'error';
  lastError?: string;
}

export interface PluginAPI {
  config: PluginConfigStore;

  ui: {
    showToast: (params: ToastParams) => Promise<void>;
  };

  device: {
    getConnected: () => Promise<DeviceInfo[]>;
    isConnected: () => Promise<boolean>;
    onConnect: (callback: DeviceConnectionCallback) => void;
    onDisconnect: (callback: DeviceConnectionCallback) => void;
    onUpdate: (callback: DeviceUpdateCallback) => void;
    rgb: {
      setEffect: (effectName: RGBEffect, speed: number, brightness: number, color: string) => Promise<void>;
      setBrightness: (brightness: number) => Promise<void>;
      setColor: (color: string) => Promise<void>;
      setSpeed: (speed: number) => Promise<void>;
      turnOff: () => Promise<void>;
      getAvailableEffects: () => readonly RGBEffect[];
      getCurrentState: () => RGBState;
    };
  };

  channelTargets: {
    getForChannel: (channel: number | string) => Promise<ChannelTargetsForChannelResponse>;
    getAll: () => Promise<ChannelTargetsAllResponse>;
  };
}
