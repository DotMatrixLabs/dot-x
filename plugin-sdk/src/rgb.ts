import { APIClient } from './client';
import type { RGBEffect } from './types';

/**
 * Controller for managing RGB lighting effects on the Decker device.
 * 
 * The Decker device features 8 RGB LEDs that can display various lighting effects.
 * This controller provides methods to control the lighting effects, colors, brightness,
 * and animation speed.
 * 
 * @category RGB Control
 * 
 * @example
 * ```typescript
 * import Plugin, { runPlugin } from 'dotx-plugin-sdk';
 * 
 * export default class RGBPlugin extends Plugin {
 *   async onLoad() {
 *     // Turn off RGB lights
 *     await this.rgb.turnOff();
 *     
 *     // Set static red color at 50% brightness
 *     await this.rgb.setEffect('static', 50, 50, '#FF0000');
 *     
 *     // Enable rainbow effect
 *     await this.rgb.setEffect('rainbow', 75, 100, '#FFFFFF');
 *     
 *     // Adjust brightness only
 *     await this.rgb.setBrightness(80);
 *     
 *     // Change color only
 *     await this.rgb.setColor('#00FF00');
 *   }
 * }
 * ```
 */
export class RGBController {
  private client: APIClient;
  
  /**
   * Available RGB lighting effects.
   * 
   * @readonly
   */
  public readonly effects: readonly RGBEffect[] = [
    'rainbow',
    'static',
    'off',
    'lightningStorm',
    'candle',
    'perimeter',
    'breathing'
  ];

  private currentEffect: RGBEffect = 'off';
  private currentSpeed: number = 50;
  private currentBrightness: number = 100;
  private currentColor: string = '#FFFFFF';

  /**
   * @internal
   * @param client - The API client for communication with Dot X
   */
  constructor(client: APIClient) {
    this.client = client;
  }

  /**
   * Set a complete RGB lighting effect with all parameters.
   * 
   * Controls the device's 8 RGB LEDs with the specified effect, speed, brightness, and color.
   * 
   * @category RGB Control
   * 
   * @param effectName - The lighting effect to apply
   * @param speed - Animation speed from 1 (fastest) to 100 (slowest)
   * @param brightness - LED brightness from 0 (off) to 100 (maximum)
   * @param color - Color in hex format (e.g., '#FF0000' for red, '#00FF00' for green)
   * @returns Promise that resolves when the effect is applied
   * 
   * @throws {Error} If the effect name is not recognized
   * 
   * @example
   * ```typescript
   * // Set static blue color at medium brightness and speed
   * await this.rgb.setEffect('static', 50, 75, '#0000FF');
   * 
   * // Set rainbow effect at fast speed and full brightness
   * await this.rgb.setEffect('rainbow', 10, 100, '#FFFFFF');
   * 
   * // Set breathing effect with purple color (slow)
   * await this.rgb.setEffect('breathing', 80, 80, '#FF00FF');
   * 
   * // Set candle flicker effect (medium speed)
   * await this.rgb.setEffect('candle', 50, 70, '#FFA500');
   * ```
   */
  async setEffect(
    effectName: RGBEffect,
    speed: number,
    brightness: number,
    color: string
  ): Promise<void> {
    if (!this.effects.includes(effectName)) {
      throw new Error(`Unknown RGB effect: ${effectName}. Available effects: ${this.effects.join(', ')}`);
    }

    // Update internal state
    this.currentEffect = effectName;
    this.currentSpeed = speed;
    this.currentBrightness = brightness;
    this.currentColor = color;

    // Call the RGB API method
    const response = await (this.client as any).call('rgb.setEffect', {
      effectName,
      speed,
      brightness,
      color
    });

    return response;
  }

  /**
   * Update only the brightness of the current RGB effect.
   * 
   * This is a convenience method that updates brightness while keeping
   * the current effect, speed, and color unchanged.
   * 
   * @category RGB Control
   * 
   * @param brightness - LED brightness from 0 (off) to 100 (maximum)
   * @returns Promise that resolves when the brightness is updated
   * 
   * @example
   * ```typescript
   * // Dim the lights to 25%
   * await this.rgb.setBrightness(25);
   * 
   * // Set to full brightness
   * await this.rgb.setBrightness(100);
   * 
   * // Turn lights almost off but not completely
   * await this.rgb.setBrightness(5);
   * ```
   */
  async setBrightness(brightness: number): Promise<void> {
    this.currentBrightness = brightness;
    return this.setEffect(
      this.currentEffect,
      this.currentSpeed,
      brightness,
      this.currentColor
    );
  }

  /**
   * Update only the color of the current RGB effect.
   * 
   * This is a convenience method that updates color while keeping
   * the current effect, speed, and brightness unchanged.
   * 
   * @category RGB Control
   * 
   * @param color - Color in hex format (e.g., '#FF0000' for red)
   * @returns Promise that resolves when the color is updated
   * 
   * @example
   * ```typescript
   * // Change to red
   * await this.rgb.setColor('#FF0000');
   * 
   * // Change to blue
   * await this.rgb.setColor('#0000FF');
   * 
   * // Change to purple
   * await this.rgb.setColor('#FF00FF');
   * 
   * // Change to warm white
   * await this.rgb.setColor('#FFE4B5');
   * ```
   */
  async setColor(color: string): Promise<void> {
    this.currentColor = color;
    return this.setEffect(
      this.currentEffect,
      this.currentSpeed,
      this.currentBrightness,
      color
    );
  }

  /**
   * Update only the animation speed of the current RGB effect.
   * 
   * This is a convenience method that updates speed while keeping
   * the current effect, brightness, and color unchanged.
   * 
   * @category RGB Control
   * 
   * @param speed - Animation speed from 1 (fastest) to 100 (slowest)
   * @returns Promise that resolves when the speed is updated
   * 
   * @example
   * ```typescript
   * // Set to fast animation
   * await this.rgb.setSpeed(10);
   * 
   * // Set to slow animation
   * await this.rgb.setSpeed(90);
   * 
   * // Set to medium speed
   * await this.rgb.setSpeed(50);
   * ```
   */
  async setSpeed(speed: number): Promise<void> {
    this.currentSpeed = speed;
    return this.setEffect(
      this.currentEffect,
      speed,
      this.currentBrightness,
      this.currentColor
    );
  }

  /**
   * Turn off all RGB lighting.
   * 
   * This is a convenience method that sets the effect to 'off'.
   * Equivalent to calling `setEffect('off', 0, 0, '#000000')`.
   * 
   * @category RGB Control
   * 
   * @returns Promise that resolves when the lights are turned off
   * 
   * @example
   * ```typescript
   * // Turn off the RGB lights
   * await this.rgb.turnOff();
   * 
   * // In an onUnload handler
   * async onUnload() {
   *   await this.rgb.turnOff();
   *   console.log('Plugin unloading, RGB lights turned off');
   * }
   * ```
   */
  async turnOff(): Promise<void> {
    return this.setEffect('off', 0, 0, '#000000');
  }

  /**
   * Get the list of available RGB effects.
   * 
   * Returns an array of all supported RGB effect names that can be used
   * with the `setEffect()` method.
   * 
   * @category RGB Control
   * 
   * @returns Array of available effect names
   * 
   * @example
   * ```typescript
   * const effects = this.rgb.getAvailableEffects();
   * console.log('Available effects:', effects);
   * // Output: ['rainbow', 'static', 'off', 'lightningStorm', 'candle', 'perimeter', 'breathing']
   * 
   * // Use in a settings dropdown
   * settings.addSelect('rgbEffect')
   *   .setLabel('RGB Effect')
   *   .setOptions(
   *     this.rgb.getAvailableEffects().map(effect => ({
   *       value: effect,
   *       label: effect.charAt(0).toUpperCase() + effect.slice(1)
   *     }))
   *   );
   * ```
   */
  getAvailableEffects(): readonly RGBEffect[] {
    return this.effects;
  }

  /**
   * Get the current RGB state.
   * 
   * Returns the current effect, speed, brightness, and color settings.
   * 
   * @category RGB Control
   * 
   * @returns Object containing current RGB settings
   * 
   * @example
   * ```typescript
   * const state = this.rgb.getCurrentState();
   * console.log('Current effect:', state.effect);
   * console.log('Current brightness:', state.brightness);
   * console.log('Current color:', state.color);
   * console.log('Current speed:', state.speed);
   * ```
   */
  getCurrentState(): {
    effect: RGBEffect;
    speed: number;
    brightness: number;
    color: string;
  } {
    return {
      effect: this.currentEffect,
      speed: this.currentSpeed,
      brightness: this.currentBrightness,
      color: this.currentColor
    };
  }
}

/**
 * Factory function to create an RGB controller instance.
 * 
 * @internal
 * @param client - The API client for communication
 * @returns A new RGBController instance
 */
export function createRGBController(client: APIClient): RGBController {
  return new RGBController(client);
}

