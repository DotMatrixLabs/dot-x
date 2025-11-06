/**
 * Device management API for monitoring device connection and state changes.
 * 
 * @category Device Management
 */

import { RGBController, createRGBController } from './rgb';

/**
 * Information about a connected device.
 * 
 * @category Device Management
 */
export interface DeviceInfo {
  /** Device name (e.g., "Decker", "Dot X") */
  name: string;
  /** Port or connection identifier */
  port: string;
  /** Connection state */
  state: 'connected' | 'disconnected';
  /** ISO timestamp of when the device connected */
  connected_at?: string;
}

/**
 * Device update event data containing control value changes.
 * 
 * @category Device Management
 */
export interface DeviceChanges {
  /** Array of changes with index, oldValue, and newValue */
  changes: Array<{ index: number; oldValue: number; newValue: number }>;
  /** Current values of all device controls */
  values: Array<{ value: number }>;
}

/**
 * Callback function type for device connection events.
 * 
 * @category Device Management
 */
export type DeviceConnectionCallback = (device: DeviceInfo) => void | Promise<void>;

/**
 * Callback function type for device update events.
 * 
 * @category Device Management
 */
export type DeviceUpdateCallback = (data: DeviceChanges) => void | Promise<void>;

/**
 * Device management API for monitoring and responding to device state changes.
 * 
 * Access this API via `this.device` in your plugin class.
 * 
 * @category Device Management
 * @displayName this.device (DeviceAPI)
 * @order first
 * 
 * @example
 * ```typescript
 * export default class MyPlugin extends Plugin {
 *   async onLoad() {
 *     // Get currently connected devices
 *     const devices = await this.device.getConnected();
 *     console.log('Connected devices:', devices);
 *     
 *     // Listen for device connections
 *     this.device.onConnect((device) => {
 *       console.log('Device connected:', device.name);
 *       this.ui.showToast({
 *         message: `${device.name} connected!`,
 *         type: 'success'
 *       });
 *     });
 *     
 *     // Listen for device disconnections
 *     this.device.onDisconnect((device) => {
 *       console.log('Device disconnected:', device.name);
 *       this.ui.showToast({
 *         message: `${device.name} disconnected`,
 *         type: 'warning'
 *       });
 *     });
 *     
 *     // Listen for device value updates
 *     this.device.onUpdate((data) => {
 *       data.changes.forEach(change => {
 *         console.log(`Control ${change.index}: ${change.oldValue} → ${change.newValue}`);
 *       });
 *     });
 *   }
 * }
 * ```
 */
export class DeviceAPI {
  private apiCallFn: (method: string, params: any) => Promise<any>;
  private connectCallbacks: DeviceConnectionCallback[] = [];
  private disconnectCallbacks: DeviceConnectionCallback[] = [];
  private updateCallbacks: DeviceUpdateCallback[] = [];
  
  /**
   * RGB controller for managing device lighting effects.
   * 
   * Control the 8 RGB LEDs on the Decker device with various effects,
   * colors, brightness levels, and animation speeds.
   * 
   * @category RGB Control
   * 
   * @example
   * ```typescript
   * // Turn off RGB lights
   * await this.device.rgb.turnOff();
   * 
   * // Set static red color
   * await this.device.rgb.setEffect('static', 50, 100, '#FF0000');
   * 
   * // Enable rainbow effect
   * await this.device.rgb.setEffect('rainbow', 75, 100, '#FFFFFF');
   * 
   * // Adjust brightness
   * await this.device.rgb.setBrightness(50);
   * 
   * // Change color
   * await this.device.rgb.setColor('#00FF00');
   * ```
   */
  public rgb: RGBController;

  constructor(apiCallFn: (method: string, params: any) => Promise<any>, client: any) {
    this.apiCallFn = apiCallFn;
    this.rgb = createRGBController(client, () => this.isConnected());
  }

  /**
   * Gets a list of all currently connected devices.
   * 
   * @returns Promise that resolves to an array of connected devices
   * 
   * @category Device Management
   * @displayName getConnected
   * 
   * @example
   * ```typescript
   * // Check if any devices are connected
   * const devices = await this.device.getConnected();
   * 
   * if (devices.length > 0) {
   *   console.log(`${devices.length} device(s) connected`);
   *   devices.forEach(device => {
   *     console.log(`- ${device.name} on ${device.port}`);
   *   });
   * } else {
   *   console.log('No devices connected');
   * }
   * ```
   */
  async getConnected(): Promise<DeviceInfo[]> {
    try {
      const result = await this.apiCallFn('device.getConnected', {});
      return result.devices || [];
    } catch (error) {
      console.error('Failed to get connected devices:', error);
      return [];
    }
  }

  /**
   * Checks if any device is currently connected.
   * 
   * @returns Promise that resolves to true if at least one device is connected, false otherwise
   * 
   * @category Device Management
   * @displayName isConnected
   * 
   * @example
   * ```typescript
   * // Check if device is connected before performing operations
   * if (await this.device.isConnected()) {
   *   await this.device.rgb.setEffect('rainbow', 75, 100, '#FFFFFF');
   * } else {
   *   console.log('No device connected');
   * }
   * ```
   */
  async isConnected(): Promise<boolean> {
    const devices = await this.getConnected();
    return devices.length > 0;
  }

  /**
   * Registers a callback function to be called when a device connects.
   * 
   * Multiple callbacks can be registered and will all be called in order.
   * 
   * @param callback - Function to call when a device connects
   * 
   * @category Device Management
   * @displayName onConnect
   * 
   * @example
   * ```typescript
   * // Simple connection handler
   * this.device.onConnect((device) => {
   *   console.log('Device connected:', device.name);
   * });
   * 
   * // Connection handler with async operations
   * this.device.onConnect(async (device) => {
   *   await this.ui.showToast({
   *     message: `${device.name} is now connected`,
   *     type: 'success'
   *   });
   *   
   *   // Initialize device-specific features
   *   await this.initializeDeviceFeatures(device);
   * });
   * ```
   */
  onConnect(callback: DeviceConnectionCallback): void {
    this.connectCallbacks.push(callback);
  }

  /**
   * Registers a callback function to be called when a device disconnects.
   * 
   * Multiple callbacks can be registered and will all be called in order.
   * 
   * @param callback - Function to call when a device disconnects
   * 
   * @category Device Management
   * @displayName onDisconnect
   * 
   * @example
   * ```typescript
   * // Simple disconnection handler
   * this.device.onDisconnect((device) => {
   *   console.log('Device disconnected:', device.name);
   * });
   * 
   * // Disconnection handler with cleanup
   * this.device.onDisconnect(async (device) => {
   *   await this.ui.showToast({
   *     message: `${device.name} has been disconnected`,
   *     type: 'warning'
   *   });
   *   
   *   // Clean up device-specific resources
   *   this.cleanupDeviceFeatures(device);
   * });
   * ```
   */
  onDisconnect(callback: DeviceConnectionCallback): void {
    this.disconnectCallbacks.push(callback);
  }

  /**
   * Registers a callback function to be called when device values are updated.
   * 
   * This is triggered when sliders, knobs, buttons, or other controls on the device change.
   * Multiple callbacks can be registered and will all be called in order.
   * 
   * @param callback - Function to call when device values change
   * 
   * @category Device Management
   * @displayName onUpdate
   * 
   * @example
   * ```typescript
   * // Handle all device value updates
   * this.device.onUpdate((data) => {
   *   console.log('Device updated:', data);
   *   
   *   // Process each change
   *   data.changes.forEach(change => {
   *     console.log(`Control ${change.index}: ${change.oldValue} → ${change.newValue}`);
   *   });
   * });
   * 
   * // Handle specific control changes
   * this.device.onUpdate((data) => {
   *   data.changes.forEach(change => {
   *     // Volume control (index 0)
   *     if (change.index === 0) {
   *       console.log(`Volume changed to ${change.newValue}%`);
   *       if (change.newValue > 80) {
   *         this.ui.showToast({
   *           message: 'Volume is very high!',
   *           type: 'warning'
   *         });
   *       }
   *     }
   *   });
   * });
   * ```
   */
  onUpdate(callback: DeviceUpdateCallback): void {
    this.updateCallbacks.push(callback);
  }

  /**
   * Internal method to trigger connect callbacks.
   * Called by the APIClient when a device_connected event is received.
   * 
   * @internal
   */
  async triggerConnect(device: DeviceInfo): Promise<void> {
    for (const callback of this.connectCallbacks) {
      try {
        await callback(device);
      } catch (error) {
        console.error('Error in device connect callback:', error);
      }
    }
  }

  /**
   * Internal method to trigger disconnect callbacks.
   * Called by the APIClient when a device_disconnected event is received.
   * 
   * @internal
   */
  async triggerDisconnect(device: DeviceInfo): Promise<void> {
    for (const callback of this.disconnectCallbacks) {
      try {
        await callback(device);
      } catch (error) {
        console.error('Error in device disconnect callback:', error);
      }
    }
  }

  /**
   * Internal method to trigger update callbacks.
   * Called by the APIClient when a device_update event is received.
   * 
   * @internal
   */
  async triggerUpdate(data: DeviceChanges): Promise<void> {
    for (const callback of this.updateCallbacks) {
      try {
        await callback(data);
      } catch (error) {
        console.error('Error in device update callback:', error);
      }
    }
  }
}

/**
 * Factory function to create a new DeviceAPI instance.
 * 
 * @internal
 * @category Device Management
 */
export function createDeviceAPI(apiCallFn: (method: string, params: any) => Promise<any>, client: any): DeviceAPI {
  return new DeviceAPI(apiCallFn, client);
}

