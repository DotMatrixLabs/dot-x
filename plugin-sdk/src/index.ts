/**
 * Dot X Plugin SDK
 * 
 * A comprehensive SDK for building plugins for the Dot X application.
 * 
 * ## Quick Start
 * 
 * ```typescript
 * import Plugin, { runPlugin } from '@dotmatrixlabs/dotx-plugin-sdk';
 * 
 * export default class MyPlugin extends Plugin {
 *   async onLoad() {
 *     // Create settings UI
 *     await this.settingsPage.addSettings((settings) => {
 *       settings.addSection('general');
 *       settings.addInput('apiKey').setLabel('API Key').setType('password');
 *     });
 *     
 *     // Monitor device connections
 *     this.device.onConnect((device) => {
 *       console.log('Device connected:', device.name);
 *     });
 *     
 *     // Monitor device updates
 *     this.device.onUpdate((data) => {
 *       console.log('Values changed:', data.changes);
 *     });
 *     
 *     // Add action button
 *     this.actionmapper
 *       .addSystemUtilButton('myAction')
 *       .setTitle('My Action')
 *       .onClick(({ selected, channel }) => {
 *         console.log(`Action on channel ${channel}: ${selected}`);
 *       });
 *   }
 * }
 * 
 * if (require.main === module) {
 *   runPlugin(MyPlugin);
 * }
 * ```
 * 
 * ## Main Features
 * 
 * - **Plugin Lifecycle**: onLoad, onUnload hooks
 * - **Device Management**: Monitor device connections and value updates
 * - **Settings Page**: Rich UI builder with inputs, switches, buttons, and more
 * - **Action Mapper**: Register System Utilities buttons
 * - **Global UI**: Toast notifications
 * - **Data Storage**: Persistent configuration with dot notation
 * 
 * @module @dotmatrixlabs/dotx-plugin-sdk
 */

/**
 * Base Plugin class - extend this to create your plugin.
 * 
 * @group Plugin Lifecycle
 */
export { default as Plugin, runPlugin } from './plugin';

/**
 * Internal API client for Socket.IO communication.
 * 
 * @group Advanced/Internal
 */
export { APIClient } from './client';

/**
 * Connection configuration and plugin metadata types.
 * 
 * @group Advanced/Internal
 */
export type { ConnectionConfig, PluginInfo } from './client';

/**
 * UI builder classes and factory functions.
 * 
 */
export { 
  SettingsBuilder, 
  createSettingsBuilder, 
  ActionMapper, 
  createActionMapper,
  SectionHandle,
  InputFieldHandle,
  ButtonFieldHandle,
  SwitchFieldHandle,
  SelectFieldHandle,
  TextFieldHandle,
  BadgeFieldHandle,
  SystemUtilButtonHandle
} from './ui';

/**
 * UI section type definition.
 * 
 * @group Settings Page
 * @group Action Mapper Modal
 */
export type { UISection } from './ui';

/**
 * RGB controller for managing Decker device lighting effects.
 * 
 * @group RGB Control
 */
export { RGBController, createRGBController } from './rgb';

/**
 * RGB types for effect names and options.
 * 
 * @group RGB Control
 */
export type { RGBEffect, RGBOptions } from './types';

/**
 * Device management API for monitoring device connections and updates.
 * 
 * @group Device Management
 */
export { DeviceAPI, createDeviceAPI } from './device';

/**
 * Device information and event types.
 * 
 * @group Device Management
 */
export type { DeviceInfo, DeviceChanges, DeviceConnectionCallback, DeviceUpdateCallback } from './device';

/**
 * Default export for convenience - the Plugin base class.
 * 
 * @group Plugin Lifecycle
 */
export { default } from './plugin';
