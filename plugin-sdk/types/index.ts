// Core plugin interfaces
export interface Plugin {
  /** Plugin lifecycle methods */
  onLoad?(): Promise<void> | void;
  onUnload?(): Promise<void> | void;
  onActivate?(): Promise<void> | void;
  onDeactivate?(): Promise<void> | void;
}

export interface PluginManifest {
  /** Unique plugin identifier */
  id: string;
  
  /** Human-readable plugin name */
  name: string;
  
  /** Plugin version */
  version: string;
  
  /** Plugin description */
  description: string;
  
  /** Plugin author */
  author: string;
  
  /** Required DotX version */
  dotxVersion: string;
  
  /** Plugin permissions */
  permissions: PluginPermission[];
  
  /** Entry point file (should be main.js for bundled plugins) */
  main: string;
  
  /** UI components to register */
  ui?: UIComponentDefinition[];
  
  /** Plugin homepage URL */
  homepage?: string;
  
  /** Plugin repository URL */
  repository?: string;
  
  /** Plugin license */
  license?: string;
  
  /** Plugin keywords/tags */
  keywords?: string[];
  
  /** Minimum Node.js version required for bundling */
  engines?: {
    node?: string;
    deno?: string;
  };
}

export type PluginPermission = 
  | 'system.audio'
  | 'system.midi'
  | 'system.apps'
  | 'system.brightness'
  | 'system.rgb'
  | 'ui.modal'
  | 'ui.settings'
  | 'ui.actionSelector'
  | 'ui.topBar'
  | 'ui.toasts'
  | 'ui.commands'
  | 'storage.local'
  | 'listeners.slider'
  | 'listeners.device'
  | 'network.fetch';

export interface UIComponentDefinition {
  /** Component ID */
  id: string;
  
  /** Component name */
  name: string;
  
  /** Component type */
  type: 'modal' | 'sidebar' | 'overlay' | 'widget';
  
  /** Component configuration - passed to DotX main app */
  config?: Record<string, any>;
}

// RPC Types
export interface RPCMessage {
  id: string;
  type: 'request' | 'response' | 'notification';
  method?: string;
  params?: any;
  result?: any;
  error?: RPCError;
}

export interface RPCError {
  code: number;
  message: string;
  data?: any;
}

// Plugin Context
export interface PluginContext {
  /** Plugin metadata */
  metadata: PluginManifest;
  
  /** RPC client for communication */
  rpc: RPCClient;
  
  /** UI injection system */
  ui: UISystem;
  
  /** Command system */
  commands: CommandAPI;
  
  /** Storage API */
  storage: StorageAPI;
  
  /** Logger */
  logger: Logger;
}

export interface RPCClient {
  /** Send RPC request */
  request(method: string, params?: any): Promise<any>;
  
  /** Send RPC notification */
  notify(method: string, params?: any): void;
  
  /** Subscribe to RPC notifications */
  subscribe(method: string, callback: (params: any) => void): void;
  
  /** Unsubscribe from RPC notifications */
  unsubscribe(method: string, callback: (params: any) => void): void;
  
  /** Check if connected to server */
  connected: boolean;
  
  /** Disconnect from server */
  disconnect(): void;
}

export interface UISystem {
  /** Register a UI component */
  registerComponent(definition: UIComponentDefinition): Promise<void>;
  
  /** Show a modal */
  showModal(componentId: string, props?: Record<string, any>): Promise<any>;
  
  /** Hide a modal */
  hideModal(componentId: string): Promise<void>;
  
  /** Show toast notification */
  showToast(message: string, options?: ToastOptions): void;
  
  /** Action selector operations */
  actionSelector: ActionSelectorAPI;
  
  /** Settings operations */
  settings: SettingsAPI;
  
  /** Top bar operations */
  topBar: TopBarAPI;
}

export interface CommandAPI {
  /** Add a command */
  addCommand(command: Command): Promise<void>;
  
  /** Remove a command */
  removeCommand(commandId: string): Promise<void>;
  
  /** Execute a command */
  executeCommand(commandId: string, ...args: any[]): Promise<any>;
}

export interface Command {
  /** Command ID */
  id: string;
  
  /** Command name */
  name: string;
  
  /** Command description */
  description?: string;
  
  /** Command callback */
  callback: (...args: any[]) => Promise<any> | any;
  
  /** Keyboard shortcut */
  hotkey?: string;
  
  /** Icon for command palette */
  icon?: string;
}

export interface ToastOptions {
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export interface ActionSelectorAPI {
  /** Add a new tab to the action selector */
  addTab(tab: ActionSelectorTab): Promise<void>;
  
  /** Add a system utility icon */
  addSystemUtility(utility: SystemUtility): Promise<void>;
  
  /** Add settings to an action selector tab */
  addTabSettings(tabId: string, settings: TabSettings): Promise<void>;
}

export interface SettingsAPI {
  /** Add input elements to settings */
  addInputs(inputs: SettingsInput[]): Promise<void>;
  
  /** Add a settings tab */
  addTab(tab: SettingsTab): Promise<void>;
  
  /** Get setting value */
  getValue(key: string): Promise<any>;
  
  /** Set setting value */
  setValue(key: string, value: any): Promise<void>;
}

export interface TopBarAPI {
  /** Add button to top bar */
  addButton(button: TopBarButton): Promise<void>;
  
  /** Remove button from top bar */
  removeButton(buttonId: string): Promise<void>;
  
  /** Update button state */
  updateButton(buttonId: string, updates: Partial<TopBarButton>): Promise<void>;
}

// Action Selector Types
export interface ActionSelectorTab {
  id: string;
  name: string;
  icon?: string;
  component?: string;
  order?: number;
}

export interface SystemUtility {
  id: string;
  name: string;
  icon: string;
  action: string;
  order?: number;
}

export interface TabSettings {
  inputs: SettingsInput[];
  layout?: 'grid' | 'list';
}

// Settings Types
export interface SettingsInput {
  id: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'color' | 'range' | 'file';
  label: string;
  value?: any;
  placeholder?: string;
  options?: Array<{ label: string; value: any }>;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  disabled?: boolean;
  description?: string;
}

export interface SettingsTab {
  id: string;
  name: string;
  icon?: string;
  inputs: SettingsInput[];
  order?: number;
}

// Top Bar Types
export interface TopBarButton {
  id: string;
  icon: string;
  tooltip?: string;
  action: string;
  order?: number;
  disabled?: boolean;
  visible?: boolean;
}

export interface StorageAPI {
  /** Get value from storage */
  get(key: string): Promise<any>;
  
  /** Set value in storage */
  set(key: string, value: any): Promise<void>;
  
  /** Remove value from storage */
  remove(key: string): Promise<void>;
  
  /** Clear all storage */
  clear(): Promise<void>;
}

export interface Logger {
  /** Log debug message */
  debug(...args: any[]): void;
  
  /** Log info message */
  info(...args: any[]): void;
  
  /** Log warning message */
  warn(...args: any[]): void;
  
  /** Log error message */
  error(...args: any[]): void;
}

// System API Types (for plugins with system permissions)
export interface SystemAPI {
  /** Audio control */
  audio?: AudioAPI;
  
  /** MIDI control */
  midi?: MidiAPI;
  
  /** App management */
  apps?: AppsAPI;
  
  /** Brightness control */
  brightness?: BrightnessAPI;
  
  /** RGB control */
  rgb?: RGBAPI;
  
  /** Event listeners */
  listeners?: ListenersAPI;
}

export interface AudioAPI {
  /** Get all audio sessions */
  getSessions(): Promise<string[]>;
  
  /** Set application volume */
  setVolume(appName: string, volume: number): Promise<void>;
  
  /** Get audio devices */
  getDevices(): Promise<string[]>;
}

export interface MidiAPI {
  /** Get available MIDI ports */
  getPorts(): Promise<string[]>;
  
  /** Connect to MIDI device */
  connect(portName: string): Promise<void>;
  
  /** Send MIDI message */
  send(message: number[]): Promise<void>;
}

export interface AppsAPI {
  /** Get installed applications */
  getInstalled(): Promise<string[]>;
  
  /** Get active application */
  getActive(): Promise<string>;
}

export interface BrightnessAPI {
  /** Set screen brightness */
  set(brightness: number, screens?: string[]): Promise<void>;
}

export interface RGBAPI {
  /** Set RGB color */
  setRGB(color: RGBColor): Promise<void>;
  
  /** Set RGB effect */
  setEffect(effect: RGBEffect): Promise<void>;
  
  /** Get current RGB color */
  getRGB(): Promise<RGBColor>;
  
  /** Get current RGB effect */
  getEffect(): Promise<RGBEffect>;
}

export interface ListenersAPI {
  /** Listen for slider value changes */
  onSliderChange(callback: (data: SliderChangeEvent) => void): void;
  
  /** Listen for device connection */
  onDeviceConnected(callback: (device: DeviceEvent) => void): void;
  
  /** Listen for device disconnection */
  onDeviceDisconnected(callback: (device: DeviceEvent) => void): void;
  
  /** Remove slider change listener */
  removeSliderListener(callback: (data: SliderChangeEvent) => void): void;
  
  /** Remove device connection listener */
  removeDeviceListener(callback: (device: DeviceEvent) => void): void;
}

// RGB Types
export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface RGBEffect {
  type: 'static' | 'breathing' | 'rainbow' | 'wave' | 'ripple' | 'custom';
  speed?: number;
  brightness?: number;
  colors?: RGBColor[];
  direction?: 'left' | 'right' | 'up' | 'down';
}

// Event Types
export interface SliderChangeEvent {
  sliderId: string;
  value: number;
  channel: number;
}

export interface DeviceEvent {
  deviceId: string;
  deviceName: string;
  deviceType: 'midi' | 'audio' | 'rgb' | 'other';
} 

// Plugin API Types
export interface PluginAPI {
  /** ActionSelector API */
  actionSelector: ActionSelectorAPI;
  
  /** Settings API */
  settings: SettingsAPI;
  
  /** RGB control API */
  rgb: RGBAPI;
  
  /** Top bar API */
  topBar: TopBarAPI;
  
  /** Toast notifications API */
  toasts: ToastsAPI;
  
  /** Modal dialogs API */
  modal: ModalAPI;
  
  /** Storage API */
  storage: StorageAPI;
  
  /** Event listeners API */
  listeners: ListenersAPI;
  
  /** Logging API */
  logs: LogsAPI;
  
  /** Command system API */
  commands: CommandSystemAPI;
  
  /** Initialize the plugin */
  init(): Promise<void>;
  
  /** Destroy the plugin */
  destroy(): Promise<void>;
}

export interface ToastsAPI {
  /** Show a toast notification */
  show(message: string, options?: ToastOptions): Promise<void>;
}

export interface ModalAPI {
  /** Show a modal dialog */
  show(id: string, config: UIComponentDefinition, options?: ModalOptions): Promise<void>;
  
  /** Hide a modal dialog */
  hide(id: string): Promise<void>;
  
  /** Update a modal dialog */
  update(id: string, config: Partial<UIComponentDefinition>): Promise<void>;
}

export interface LogsAPI {
  /** Log info message */
  info(message: string): Promise<void>;
  
  /** Log warning message */
  warn(message: string): Promise<void>;
  
  /** Log error message */
  error(message: string): Promise<void>;
  
  /** Log debug message */
  debug(message: string): Promise<void>;
}

export interface CommandSystemAPI {
  /** Register a command */
  register(command: Command): Promise<void>;
  
  /** Unregister a command */
  unregister(id: string): Promise<void>;
  
  /** Execute a command */
  execute(id: string): Promise<void>;
  
  /** List all commands */
  list(): Promise<Command[]>;
}

export interface ModalOptions {
  /** Modal width */
  width?: number;
  
  /** Modal height */
  height?: number;
  
  /** Is modal closable */
  closable?: boolean;
  
  /** Modal z-index */
  zIndex?: number;
  
  /** Show backdrop */
  backdrop?: boolean;
  
  /** Close on backdrop click */
  closeOnBackdrop?: boolean;
}

export interface StorageOptions {
  /** Storage scope */
  scope?: 'global' | 'plugin';
  
  /** Default value if key doesn't exist */
  defaultValue?: any;
  
  /** Encrypt stored value */
  encrypt?: boolean;
}

export type ListenerCallback<T> = (event: T) => void;

export interface DeviceChangeEvent {
  /** Device ID */
  deviceId: string;
  
  /** Device name */
  deviceName: string;
  
  /** Device type */
  deviceType: 'midi' | 'audio' | 'rgb' | 'other';
  
  /** Is device connected */
  connected: boolean;
}

// Alias for backwards compatibility
export type Permission = PluginPermission; 