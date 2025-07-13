import { createRPCClient } from '../rpc/client';
import type { 
  RPCClient, 
  Plugin, 
  PluginManifest,
  PluginAPI, 
  Permission,
  ActionSelectorAPI,
  ActionSelectorTab,
  SystemUtility,
  TabSettings,
  SettingsAPI,
  SettingsInput,
  SettingsTab,
  RGBAPI,
  TopBarAPI,
  TopBarButton,
  ToastsAPI,
  ModalAPI,
  StorageAPI,
  ListenersAPI,
  LogsAPI,
  CommandSystemAPI,
  Command,
  UIComponentDefinition,
  RGBColor,
  RGBEffect,
  ToastOptions,
  ModalOptions,
  StorageOptions,
  ListenerCallback,
  SliderChangeEvent,
  DeviceChangeEvent,
  DeviceEvent
} from '../types/index';

// Global declarations for runtime environments
declare global {
  var Deno: {
    readTextFile(path: string): Promise<string>;
  } | undefined;
}

// Internal implementation classes
class ActionSelectorImpl implements ActionSelectorAPI {
  constructor(private rpc: RPCClient) {}

  async addTab(tab: ActionSelectorTab): Promise<void> {
    await this.rpc.request('ui.actionSelector.addTab', { tab });
  }

  async addSystemUtility(utility: SystemUtility): Promise<void> {
    await this.rpc.request('ui.actionSelector.addSystemUtility', { utility });
  }

  async addTabSettings(tabId: string, settings: TabSettings): Promise<void> {
    await this.rpc.request('ui.actionSelector.addTabSettings', { tabId, settings });
  }
}

class SettingsImpl implements SettingsAPI {
  constructor(private rpc: RPCClient) {}

  async addInputs(inputs: SettingsInput[]): Promise<void> {
    await this.rpc.request('ui.settings.addInputs', { inputs });
  }

  async addTab(tab: SettingsTab): Promise<void> {
    await this.rpc.request('ui.settings.addTab', { tab });
  }

  async getValue(key: string): Promise<any> {
    const result = await this.rpc.request('ui.settings.getValue', { key });
    return result.value;
  }

  async setValue(key: string, value: any): Promise<void> {
    await this.rpc.request('ui.settings.setValue', { key, value });
  }
}

class RGBImpl implements RGBAPI {
  constructor(private rpc: RPCClient) {}

  async setRGB(color: RGBColor): Promise<void> {
    await this.rpc.request('system.rgb.setRGB', { color });
  }

  async getRGB(): Promise<RGBColor> {
    const result = await this.rpc.request('system.rgb.getRGB');
    return result.color;
  }

  async setEffect(effect: RGBEffect): Promise<void> {
    await this.rpc.request('system.rgb.setEffect', { effect });
  }

  async getEffect(): Promise<RGBEffect> {
    const result = await this.rpc.request('system.rgb.getEffect');
    return result.effect;
  }

  // Convenience methods for backward compatibility
  async setColor(color: RGBColor): Promise<void> {
    await this.setRGB(color);
  }

  async getColor(): Promise<RGBColor> {
    return await this.getRGB();
  }
}

class TopBarImpl implements TopBarAPI {
  constructor(private rpc: RPCClient) {}

  async addButton(button: TopBarButton): Promise<void> {
    await this.rpc.request('ui.topBar.addButton', { button });
  }

  async removeButton(buttonId: string): Promise<void> {
    await this.rpc.request('ui.topBar.removeButton', { buttonId });
  }

  async updateButton(buttonId: string, updates: Partial<TopBarButton>): Promise<void> {
    await this.rpc.request('ui.topBar.updateButton', { buttonId, updates });
  }
}

class ToastsImpl implements ToastsAPI {
  constructor(private rpc: RPCClient) {}

  async show(message: string, options?: ToastOptions): Promise<void> {
    await this.rpc.request('ui.toasts.show', { message, options });
  }
}

class ModalImpl implements ModalAPI {
  constructor(private rpc: RPCClient) {}

  async show(id: string, config: UIComponentDefinition, options?: ModalOptions): Promise<void> {
    await this.rpc.request('ui.modal.show', { id, config, options });
  }

  async hide(id: string): Promise<void> {
    await this.rpc.request('ui.modal.hide', { id });
  }

  async update(id: string, config: Partial<UIComponentDefinition>): Promise<void> {
    await this.rpc.request('ui.modal.update', { id, config });
  }
}

class StorageImpl implements StorageAPI {
  constructor(private rpc: RPCClient) {}

  async get(key: string): Promise<any> {
    const result = await this.rpc.request('storage.get', { key });
    return result.value;
  }

  async set(key: string, value: any): Promise<void> {
    await this.rpc.request('storage.set', { key, value });
  }

  async remove(key: string): Promise<void> {
    await this.rpc.request('storage.remove', { key });
  }

  async clear(): Promise<void> {
    await this.rpc.request('storage.clear');
  }
}

class ListenersImpl implements ListenersAPI {
  constructor(private rpc: RPCClient) {}

  onSliderChange(callback: (data: SliderChangeEvent) => void): void {
    this.rpc.subscribe('listeners.sliderChange', callback);
  }

  onDeviceConnected(callback: (device: DeviceEvent) => void): void {
    this.rpc.subscribe('listeners.deviceConnected', callback);
  }

  onDeviceDisconnected(callback: (device: DeviceEvent) => void): void {
    this.rpc.subscribe('listeners.deviceDisconnected', callback);
  }

  removeSliderListener(callback: (data: SliderChangeEvent) => void): void {
    this.rpc.unsubscribe('listeners.sliderChange', callback);
  }

  removeDeviceListener(callback: (device: DeviceEvent) => void): void {
    this.rpc.unsubscribe('listeners.deviceConnected', callback);
    this.rpc.unsubscribe('listeners.deviceDisconnected', callback);
  }

  // Convenience methods for backward compatibility
  onDeviceChange(callback: ListenerCallback<DeviceChangeEvent>): void {
    this.rpc.subscribe('listeners.deviceChange', callback);
  }

  removeSliderChangeListener(callback: ListenerCallback<SliderChangeEvent>): void {
    this.rpc.unsubscribe('listeners.sliderChange', callback);
  }

  removeDeviceChangeListener(callback: ListenerCallback<DeviceChangeEvent>): void {
    this.rpc.unsubscribe('listeners.deviceChange', callback);
  }
}

class LogsImpl implements LogsAPI {
  constructor(private rpc: RPCClient) {}

  async info(message: string): Promise<void> {
    await this.rpc.request('system.log.info', { message });
  }

  async warn(message: string): Promise<void> {
    await this.rpc.request('system.log.warn', { message });
  }

  async error(message: string): Promise<void> {
    await this.rpc.request('system.log.error', { message });
  }

  async debug(message: string): Promise<void> {
    await this.rpc.request('system.log.debug', { message });
  }
}

class CommandSystemImpl implements CommandSystemAPI {
  constructor(private rpc: RPCClient) {}

  async register(command: Command): Promise<void> {
    await this.rpc.request('ui.commands.register', command);
  }

  async unregister(id: string): Promise<void> {
    await this.rpc.request('ui.commands.unregister', { id });
  }

  async execute(id: string): Promise<void> {
    await this.rpc.request('ui.commands.execute', { id });
  }

  async list(): Promise<Command[]> {
    const result = await this.rpc.request('ui.commands.list');
    return result.commands;
  }
}

class PluginAPIImpl implements PluginAPI {
  public readonly actionSelector: ActionSelectorAPI;
  public readonly settings: SettingsAPI;
  public readonly rgb: RGBAPI;
  public readonly topBar: TopBarAPI;
  public readonly toasts: ToastsAPI;
  public readonly modal: ModalAPI;
  public readonly storage: StorageAPI;
  public readonly listeners: ListenersAPI;
  public readonly logs: LogsAPI;
  public readonly commands: CommandSystemAPI;

  constructor(private rpc: RPCClient) {
    this.actionSelector = new ActionSelectorImpl(rpc);
    this.settings = new SettingsImpl(rpc);
    this.rgb = new RGBImpl(rpc);
    this.topBar = new TopBarImpl(rpc);
    this.toasts = new ToastsImpl(rpc);
    this.modal = new ModalImpl(rpc);
    this.storage = new StorageImpl(rpc);
    this.listeners = new ListenersImpl(rpc);
    this.logs = new LogsImpl(rpc);
    this.commands = new CommandSystemImpl(rpc);
  }

  async init(): Promise<void> {
    // Plugin initialization - wait for RPC connection
    if (!this.rpc.connected) {
      await new Promise((resolve) => {
        const checkConnection = () => {
          if (this.rpc.connected) {
            resolve(void 0);
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });
    }
  }

  async destroy(): Promise<void> {
    // Plugin cleanup
    this.rpc.disconnect();
  }
}

/**
 * Create plugin API instance with manifest
 */
export function createPluginAPI(manifest: PluginManifest): PluginAPI {
  // Create RPC client with plugin information
  const rpc = createRPCClient(
    'http://localhost:8080', // Default server URL
    {
      name: manifest.name,
      permissions: manifest.permissions
    }
  );

  return new PluginAPIImpl(rpc);
}

/**
 * Initialize plugin with manifest
 */
export async function initPlugin(manifest: PluginManifest): Promise<PluginAPI> {
  const api = createPluginAPI(manifest);
  await api.init();
  return api;
}

/**
 * Load manifest from file system (for Node.js/Deno environments)
 */
export async function loadManifest(manifestPath: string): Promise<PluginManifest> {
  try {
    let manifestContent: string;
    
    // Try different runtime environments
    if (typeof Deno !== 'undefined') {
      // Deno environment
      manifestContent = await Deno.readTextFile(manifestPath);
    } else if (typeof require !== 'undefined') {
      // Node.js environment
      const fs = require('fs').promises;
      manifestContent = await fs.readFile(manifestPath, 'utf8');
    } else {
      // Browser environment - use fetch
      const response = await fetch(manifestPath);
      manifestContent = await response.text();
    }
    
    const manifest = JSON.parse(manifestContent) as PluginManifest;
    
    // Validate required fields
    if (!manifest.id || !manifest.name || !manifest.version) {
      throw new Error('Invalid manifest: missing required fields (id, name, version)');
    }
    
    return manifest;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load manifest from ${manifestPath}: ${errorMessage}`);
  }
}

/**
 * Initialize plugin from manifest file
 */
export async function initPluginFromManifest(manifestPath: string): Promise<PluginAPI> {
  const manifest = await loadManifest(manifestPath);
  return initPlugin(manifest);
}

// Export everything from types
export * from '../types/index'; 