import type { PluginPermission } from '../types/index.ts';

/**
 * Permission levels for plugin capabilities
 */
export enum PermissionLevel {
  NONE = 0,
  READ = 1,
  WRITE = 2,
  EXECUTE = 3
}

/**
 * Permission configuration for different system areas
 */
export interface PermissionConfig {
  [key: string]: PermissionLevel;
}

/**
 * Default permission configurations
 */
export const DEFAULT_PERMISSIONS: Record<PluginPermission, PermissionConfig> = {
  'system.audio': {
    'getSessions': PermissionLevel.READ,
    'setVolume': PermissionLevel.WRITE,
    'getDevices': PermissionLevel.READ
  },
  'system.midi': {
    'getPorts': PermissionLevel.READ,
    'connect': PermissionLevel.WRITE,
    'send': PermissionLevel.EXECUTE
  },
  'system.apps': {
    'getInstalled': PermissionLevel.READ,
    'getActive': PermissionLevel.READ
  },
  'system.brightness': {
    'set': PermissionLevel.WRITE
  },
  'system.rgb': {
    'setRGB': PermissionLevel.WRITE,
    'setEffect': PermissionLevel.WRITE,
    'getRGB': PermissionLevel.READ,
    'getEffect': PermissionLevel.READ
  },
  'ui.modal': {
    'showModal': PermissionLevel.WRITE,
    'hideModal': PermissionLevel.WRITE,
    'registerComponent': PermissionLevel.WRITE
  },
  'ui.settings': {
    'addInputs': PermissionLevel.WRITE,
    'addTab': PermissionLevel.WRITE,
    'getValue': PermissionLevel.READ,
    'setValue': PermissionLevel.WRITE
  },
  'ui.actionSelector': {
    'addTab': PermissionLevel.WRITE,
    'addSystemUtility': PermissionLevel.WRITE,
    'addTabSettings': PermissionLevel.WRITE
  },
  'ui.topBar': {
    'addButton': PermissionLevel.WRITE,
    'removeButton': PermissionLevel.WRITE,
    'updateButton': PermissionLevel.WRITE
  },
  'ui.toasts': {
    'showToast': PermissionLevel.WRITE
  },
  'ui.commands': {
    'addCommand': PermissionLevel.WRITE,
    'removeCommand': PermissionLevel.WRITE,
    'executeCommand': PermissionLevel.EXECUTE
  },
  'storage.local': {
    'get': PermissionLevel.READ,
    'set': PermissionLevel.WRITE,
    'remove': PermissionLevel.WRITE,
    'clear': PermissionLevel.WRITE
  },
  'listeners.slider': {
    'onSliderChange': PermissionLevel.READ,
    'removeSliderListener': PermissionLevel.WRITE
  },
  'listeners.device': {
    'onDeviceConnected': PermissionLevel.READ,
    'onDeviceDisconnected': PermissionLevel.READ,
    'removeDeviceListener': PermissionLevel.WRITE
  },
  'network.fetch': {
    'fetch': PermissionLevel.EXECUTE
  }
};

/**
 * Check if a plugin has permission to perform an action
 */
export function hasPermission(
  pluginPermissions: PluginPermission[],
  requiredPermission: PluginPermission,
  action: string
): boolean {
  if (!pluginPermissions.includes(requiredPermission)) {
    return false;
  }

  const permissionConfig = DEFAULT_PERMISSIONS[requiredPermission];
  if (!permissionConfig) {
    return false;
  }

  const requiredLevel = permissionConfig[action];
  return requiredLevel !== undefined && requiredLevel !== PermissionLevel.NONE;
}

/**
 * Get required permission level for an action
 */
export function getPermissionLevel(
  permission: PluginPermission,
  action: string
): PermissionLevel {
  const permissionConfig = DEFAULT_PERMISSIONS[permission];
  if (!permissionConfig) {
    return PermissionLevel.NONE;
  }

  return permissionConfig[action] || PermissionLevel.NONE;
}

/**
 * Validate plugin permissions
 */
export function validatePermissions(permissions: PluginPermission[]): boolean {
  return permissions.every(permission => 
    Object.keys(DEFAULT_PERMISSIONS).includes(permission)
  );
} 