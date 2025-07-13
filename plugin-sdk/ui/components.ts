import type { 
  UIComponentDefinition, 
  UISystem, 
  ToastOptions,
  RPCClient,
  CommandAPI,
  Command 
} from '../types/index.ts';

export class UISystemImpl implements UISystem {
  constructor(private rpc: RPCClient) {}

  /**
   * Register a UI component - tells DotX about available components
   */
  async registerComponent(definition: UIComponentDefinition): Promise<void> {
    // Tell DotX main app to register this component
    await this.rpc.request('ui.registerComponent', definition);
  }

  /**
   * Show a modal - creates modal in DotX main app
   */
  async showModal(componentId: string, props?: Record<string, any>): Promise<any> {
    // Tell DotX main app to show the modal
    return await this.rpc.request('ui.showModal', {
      componentId,
      props: props || {}
    });
  }

  /**
   * Hide a modal - hides modal in DotX main app
   */
  async hideModal(componentId: string): Promise<void> {
    // Tell DotX main app to hide the modal
    await this.rpc.request('ui.hideModal', { componentId });
  }

  /**
   * Show toast notification - creates toast in DotX main app
   */
  showToast(message: string, options?: ToastOptions): void {
    // Tell DotX main app to show toast
    this.rpc.notify('ui.showToast', { message, options });
  }

  /**
   * Action selector operations - all create UI in DotX main app
   */
  actionSelector = {
    addTab: (tab: any) => this.rpc.request('ui.actionSelector.addTab', tab),
    addSystemUtility: (utility: any) => this.rpc.request('ui.actionSelector.addSystemUtility', utility),
    addTabSettings: (tabId: string, settings: any) => this.rpc.request('ui.actionSelector.addTabSettings', { tabId, settings })
  };

  /**
   * Settings operations - all create UI in DotX main app
   */
  settings = {
    addInputs: (inputs: any[]) => this.rpc.request('ui.settings.addInputs', inputs),
    addTab: (tab: any) => this.rpc.request('ui.settings.addTab', tab),
    getValue: (key: string) => this.rpc.request('ui.settings.getValue', { key }),
    setValue: (key: string, value: any) => this.rpc.request('ui.settings.setValue', { key, value })
  };

  /**
   * Top bar operations - all create UI in DotX main app
   */
  topBar = {
    addButton: (button: any) => this.rpc.request('ui.topBar.addButton', button),
    removeButton: (buttonId: string) => this.rpc.request('ui.topBar.removeButton', { buttonId }),
    updateButton: (buttonId: string, updates: any) => this.rpc.request('ui.topBar.updateButton', { buttonId, updates })
  };
}

export class CommandSystemImpl implements CommandAPI {
  private commands = new Map<string, Command>();
  
  constructor(private rpc: RPCClient) {}

  /**
   * Add a command (like Obsidian's addCommand)
   */
  async addCommand(command: Command): Promise<void> {
    // Store command locally for callback execution
    this.commands.set(command.id, command);
    
    // Tell DotX main app to register this command
    await this.rpc.request('commands.addCommand', {
      id: command.id,
      name: command.name,
      description: command.description,
      hotkey: command.hotkey,
      icon: command.icon
    });
  }

  /**
   * Remove a command
   */
  async removeCommand(commandId: string): Promise<void> {
    // Remove from local storage
    this.commands.delete(commandId);
    
    // Tell DotX main app to remove this command
    await this.rpc.request('commands.removeCommand', { commandId });
  }

  /**
   * Execute a command
   */
  async executeCommand(commandId: string, ...args: any[]): Promise<any> {
    const command = this.commands.get(commandId);
    if (!command) {
      throw new Error(`Command not found: ${commandId}`);
    }
    
    return await command.callback(...args);
  }

  /**
   * Handle command execution from main app
   */
  async handleCommandExecution(commandId: string, ...args: any[]): Promise<any> {
    return await this.executeCommand(commandId, ...args);
  }
}

/**
 * Modal helper - creates modal data structure for DotX main app
 */
export function createModalConfig(options: {
  title: string;
  content: string;
  buttons?: Array<{
    text: string;
    action: string;
    style?: 'primary' | 'secondary' | 'danger';
  }>;
  size?: 'small' | 'medium' | 'large';
}) {
  return {
    title: options.title,
    content: options.content,
    buttons: options.buttons || [],
    size: options.size || 'medium'
  };
}

/**
 * Settings panel helper - creates settings structure for DotX main app
 */
export function createSettingsConfig(options: {
  title: string;
  sections: Array<{
    title: string;
    fields: Array<{
      type: 'text' | 'number' | 'boolean' | 'select' | 'color' | 'range';
      label: string;
      key: string;
      value?: any;
      options?: Array<{ label: string; value: any }>;
      min?: number;
      max?: number;
      step?: number;
    }>;
  }>;
}) {
  return {
    title: options.title,
    sections: options.sections
  };
}

/**
 * Toast helper - creates toast configuration for DotX main app
 */
export function createToastConfig(message: string, options?: {
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}) {
  return {
    message,
    type: options?.type || 'info',
    duration: options?.duration || 3000,
    position: options?.position || 'top-right'
  };
} 