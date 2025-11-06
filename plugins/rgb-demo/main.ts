import Plugin, { runPlugin, RGBEffect } from "../../plugin-sdk/src/index";

console.log("RGB Demo Plugin loaded!");

export default class RGBDemoPlugin extends Plugin {

  private settings: any;
  private currentEffectIndex: number = 0;
  private autoTestInterval: NodeJS.Timeout | null = null;

  async onLoad() {
    console.log("RGB Demo Plugin initialized!");

    this.initConfig();
    this.getConfig();

    try {
      // Create settings page with RGB controls
      await this.settingsPage.addSettings((settings) => {
        // ========== MAIN CONTROLS SECTION ==========
        const general = settings.addSection('General').setName('Complete RGB Control');

        // Effect selector dropdown
        const effectSelect = settings.addSelect('effect')
          .setLabel('RGB Effect')
          .setPlaceholder('Select an effect')
          .setOptions(
            this.device.rgb.getAvailableEffects().map((effect: string) => ({
              value: effect,
              label: effect.charAt(0).toUpperCase() + effect.slice(1).replace(/([A-Z])/g, ' $1')
            }))
          )
          .setValue(this.settings?.effect || 'rainbow')
          .setDesc('Choose the RGB lighting effect to display')
          .onChange((data) => {
            console.log('Effect changed:', data.value);
            effectSelect.setValue(data.value);
            this.config.set('settings.effect', data.value);
            this.applyCurrentSettings();
          });

        // Speed slider
        const speedInput = settings.addInput('speed')
          .setType('number')
          .setLabel('Animation Speed')
          .setPlaceholder('50')
          .setValue(this.settings?.speed || 50)
          .setRequired(true)
          .setDesc('Animation speed from 1 (fastest) to 100 (slowest)')
          .onChange((data) => {
            console.log('Speed changed:', data.value);
            const speed = Math.max(1, Math.min(100, parseInt(data.value) || 50));
            speedInput.setValue(speed);
            this.config.set('settings.speed', speed);
            this.applyCurrentSettings();
          });

        // Brightness slider
        const brightnessInput = settings.addInput('brightness')
          .setType('number')
          .setLabel('Brightness')
          .setPlaceholder('100')
          .setValue(this.settings?.brightness || 100)
          .setRequired(true)
          .setDesc('LED brightness from 0 (off) to 100 (maximum)')
          .onChange((data) => {
            console.log('Brightness changed:', data.value);
            const brightness = Math.max(0, Math.min(100, parseInt(data.value) || 100));
            brightnessInput.setValue(brightness);
            this.config.set('settings.brightness', brightness);
            this.applyCurrentSettings();
          });

        // Color picker
        const colorInput = settings.addInput('color')
          .setType('color')
          .setLabel('Color')
          .setValue(this.settings?.color || '#FFFFFF')
          .setDesc('Select the RGB color for static and breathing effects')
          .onChange((data) => {
            console.log('Color changed:', data.value);
            colorInput.setValue(data.value);
            this.config.set('settings.color', data.value);
            this.applyCurrentSettings();
          });

        // Apply button
        settings.addButton('applyButton')
          .setTitle('Apply All Settings')
          .onClick(() => {
            console.log('Apply button clicked!');
            this.applyCurrentSettings();
          });

        // ========== INDIVIDUAL HELPER FUNCTIONS SECTION ==========
        const helpers = settings.addSection('helpers')
          .setExpandable(true)
          .setExpanded(false)
          .setName('Test Individual RGB Functions');

        // Status badge
        settings.addBadge('helperStatus')
          .setLabel('Helper Functions')
          .setText('Test setBrightness(), setColor(), setSpeed(), turnOff()')
          .setDesc('These functions update only one parameter while keeping others unchanged')
          .setStyle('info');

        // Test setBrightness() with dropdown
        const brightnessTestSelect = settings.addSelect('brightnessTest')
          .setLabel('Test setBrightness()')
          .setPlaceholder('Select brightness')
          .setOptions([
            { value: '0', label: '0% - Off' },
            { value: '25', label: '25% - Very Dim' },
            { value: '50', label: '50% - Medium' },
            { value: '75', label: '75% - Bright' },
            { value: '100', label: '100% - Maximum' }
          ])
          .setValue('100')
          .setDesc('Calls this.device.rgb.setBrightness() with selected value')
          .onChange(async (data) => {
            const brightness = parseInt(data.value);
            await this.device.rgb.setBrightness(brightness);
            this.config.set('settings.brightness', brightness);
            brightnessInput.setValue(brightness);
          });

        // Test setSpeed() with dropdown
        const speedTestSelect = settings.addSelect('speedTest')
          .setLabel('Test setSpeed()')
          .setPlaceholder('Select speed')
          .setOptions([
            { value: '1', label: '1 - Fastest' },
            { value: '25', label: '25 - Fast' },
            { value: '50', label: '50 - Medium' },
            { value: '75', label: '75 - Slow' },
            { value: '100', label: '100 - Slowest' }
          ])
          .setValue('50')
          .setDesc('Calls this.device.rgb.setSpeed() with selected value (1=fastest, 100=slowest)')
          .onChange(async (data) => {
            const speed = parseInt(data.value);
            await this.device.rgb.setSpeed(speed);
            this.config.set('settings.speed', speed);
            speedInput.setValue(speed);
          });

        // Test setColor() with dropdown
        const colorTestSelect = settings.addSelect('colorTest')
          .setLabel('Test setColor()')
          .setPlaceholder('Select color')
          .setOptions([
            { value: '#FF0000', label: '🔴 Red' },
            { value: '#00FF00', label: '🟢 Green' },
            { value: '#0000FF', label: '🔵 Blue' },
            { value: '#FFFF00', label: '🟡 Yellow' },
            { value: '#FF00FF', label: '🟣 Magenta' },
            { value: '#00FFFF', label: '🔷 Cyan' },
            { value: '#FFFFFF', label: '⚪ White' },
            { value: '#FFA500', label: '🟠 Orange' },
            { value: '#FF1493', label: '💗 Pink' },
            { value: '#800080', label: '🟪 Purple' }
          ])
          .setValue('#FFFFFF')
          .setDesc('Calls this.device.rgb.setColor() with selected color')
          .onChange(async (data) => {
            await this.device.rgb.setColor(data.value);
            this.config.set('settings.color', data.value);
            colorInput.setValue(data.value);
          });

        // Test turnOff() button
        settings.addButton('turnOffTest')
          .setTitle('Test turnOff()')
          .setStyle('danger')
          .onClick(async () => {
            console.log('turnOff() test clicked!');
            await this.device.rgb.turnOff();
          });

        // ========== EFFECT TESTING SECTION ==========
        const effectTests = settings.addSection('effectTests')
          .setExpandable(true)
          .setExpanded(false)
          .setName('Test All RGB Effects');

        // Enable auto-testing switch
        const autoTestSwitch = settings.addSwitch('autoTest')
          .setLabel('Enable Auto-Testing')
          .setValue(this.settings?.autoTest || false)
          .setDesc('Automatically cycle through all effects when enabled')
          .onChange((data) => {
            this.config.set('settings.autoTest', data.value);
            if (data.value) {
              this.startAutoTesting();
            } else {
              this.stopAutoTesting();
            }
          });

        // Dropdown to test each effect individually
        const effectTestSelect = settings.addSelect('effectTest')
          .setLabel('Test Individual Effects')
          .setPlaceholder('Select effect to test')
          .setOptions([
            { value: 'rainbow', label: '🌈 Rainbow - Color cycling' },
            { value: 'static', label: '🎨 Static - Solid color' },
            { value: 'breathing', label: '💨 Breathing - Fade in/out' },
            { value: 'lightningStorm', label: '⚡ Lightning Storm - Random flashes' },
            { value: 'candle', label: '🕯️ Candle - Flickering' },
            { value: 'perimeter', label: '🔄 Perimeter - Running lights' },
            { value: 'off', label: '⚫ Off - Disabled' }
          ])
          .setDesc('Test each effect using setEffect() method')
          .onChange(async (data) => {
            const effect = data.value as RGBEffect;
            const speed = this.config.get('settings.speed', 50) ?? 50;
            const brightness = this.config.get('settings.brightness', 100) ?? 100;
            const color = this.config.get('settings.color', '#FFFFFF') ?? '#FFFFFF';
            
            await this.device.rgb.setEffect(effect, speed, brightness, color);
            effectSelect.setValue(effect);
            this.config.set('settings.effect', effect);
          });

        // ========== QUICK PRESETS SECTION ==========
        const presets = settings.addSection('presets')
          .setExpandable(true)
          .setExpanded(false)
          .setName('Quick Effect Presets');

        settings.addText('presetsInfo')
          .setLabel('Preset Effects')
          .setText('Pre-configured RGB effects with optimized settings')
          .setStyle('muted');
        
        // Preset buttons
        settings.addButton('presetRainbow')
          .setTitle('🌈 Rainbow Spectrum')
          .onClick(async () => {
            await this.device.rgb.setEffect('rainbow', 75, 100, '#FFFFFF');
            effectSelect.setValue('rainbow');
            speedInput.setValue(75);
            brightnessInput.setValue(100);
          });

        settings.addButton('presetRedAlert')
          .setTitle('🚨 Red Alert')
          .onClick(async () => {
            await this.device.rgb.setEffect('breathing', 80, 100, '#FF0000');
            effectSelect.setValue('breathing');
            colorInput.setValue('#FF0000');
            speedInput.setValue(80);
            brightnessInput.setValue(100);
            this.config.set('settings.effect', 'breathing');
            this.config.set('settings.color', '#FF0000');
            this.config.set('settings.speed', 80);
            this.config.set('settings.brightness', 100);
          });

        settings.addButton('presetCandlelight')
          .setTitle('🕯️ Warm Candlelight')
          .onClick(async () => {
            await this.device.rgb.setEffect('candle', 50, 60, '#FFA500');
            effectSelect.setValue('candle');
            colorInput.setValue('#FFA500');
            speedInput.setValue(50);
            brightnessInput.setValue(60);
          });

        settings.addButton('presetStorm')
          .setTitle('⚡ Lightning Storm')
          .onClick(async () => {
            await this.device.rgb.setEffect('lightningStorm', 90, 100, '#FFFFFF');
            effectSelect.setValue('lightningStorm');
            speedInput.setValue(90);
            brightnessInput.setValue(100);
          });

        settings.addButton('presetNightMode')
          .setTitle('🌙 Night Mode')
          .onClick(async () => {
            await this.device.rgb.setEffect('static', 0, 10, '#4169E1');
            effectSelect.setValue('static');
            colorInput.setValue('#4169E1');
            speedInput.setValue(0);
            brightnessInput.setValue(10);
          });

        settings.addButton('presetPartyMode')
          .setTitle('🎉 Party Mode')
          .onClick(async () => {
            await this.device.rgb.setEffect('perimeter', 100, 100, '#FF00FF');
            effectSelect.setValue('perimeter');
            colorInput.setValue('#FF00FF');
            speedInput.setValue(100);
            brightnessInput.setValue(100);
          });

        // ========== CURRENT STATE DISPLAY ==========
        const statusSection = settings.addSection('status')
          .setExpandable(true)
          .setExpanded(false)
          .setName('Current RGB State');

        const currentState = this.device.rgb.getCurrentState();
        
        settings.addBadge('currentEffect')
          .setLabel('Current Effect')
          .setText(currentState.effect)
          .setStyle('success');

        settings.addText('currentSpeed')
          .setLabel('Current Speed')
          .setText(`${currentState.speed}%`)
          .setStyle('info');

        settings.addText('currentBrightness')
          .setLabel('Current Brightness')
          .setText(`${currentState.brightness}%`)
          .setStyle('info');

        settings.addText('currentColor')
          .setLabel('Current Color')
          .setText(currentState.color)
          .setStyle('info');

        settings.addButton('refreshState')
          .setTitle('Refresh State Display')
          .onClick(() => {
            const state = this.device.rgb.getCurrentState();
            console.log('Current RGB state:', state);
          });

        // ========== DEVICE INTEGRATION SECTION ==========
        const deviceIntegration = settings.addSection('deviceIntegration')
          .setExpandable(true)
          .setExpanded(false)
          .setName('Device Integration');

        // RGB Control Mode selector
        const rgbControlMode = settings.addSelect('rgbControlMode')
          .setLabel('Slider RGB Control Mode')
          .setPlaceholder('Select control mode')
          .setOptions([
            { value: 'disabled', label: '❌ Disabled' },
            { value: 'hue', label: '🌈 Slider 0 = Hue (0-360°)' },
            { value: 'rgb-mix', label: '🎨 Sliders 0,1,2 = R,G,B Mix' }
          ])
          .setValue(this.settings?.rgbControlMode || 'disabled')
          .setDesc('Choose how device sliders control RGB lighting')
          .onChange((data) => {
            this.config.set('settings.rgbControlMode', data.value);
            console.log('RGB control mode changed to:', data.value);
            
            // Update info text based on mode
            if (data.value === 'hue') {
              rgbModeInfo.setText('Slider 0: 0% = Red, 33% = Green, 66% = Blue, 100% = Red (full hue cycle)');
            } else if (data.value === 'rgb-mix') {
              rgbModeInfo.setText('Slider 0 = Red (0-255), Slider 1 = Green (0-255), Slider 2 = Blue (0-255). Mix colors freely!');
            } else {
              rgbModeInfo.setText('Slider control is disabled. Change RGB manually from settings above.');
            }
          });

        const rgbModeInfo = settings.addText('sliderRGBInfo')
          .setLabel('How It Works')
          .setText(
            this.settings?.rgbControlMode === 'hue' 
              ? 'Slider 0: 0% = Red, 33% = Green, 66% = Blue, 100% = Red (full hue cycle)'
              : this.settings?.rgbControlMode === 'rgb-mix'
              ? 'Slider 0 = Red (0-255), Slider 1 = Green (0-255), Slider 2 = Blue (0-255). Mix colors freely!'
              : 'Slider control is disabled. Change RGB manually from settings above.'
          )
          .setStyle('muted');
      });
      
      console.log("RGB Demo Plugin settings created successfully!");

      // Add action button for cycling through effects
      const cycleButton = this.actionmapper
        .addSystemUtilButton('cycleRGB')
        .setTitle('RGB Cycle')
        .setIcon('fas fa-lg fa-palette')
        .onClick(({ selected, channel }) => {
          console.log('RGB Cycle clicked on channel', channel, 'selected:', selected);
          
          if (selected) {
            this.cycleToNextEffect();
          } else {
            this.device.rgb.turnOff();
          }
        });

      // Add settings to the cycle button
      cycleButton.addSettings((settings) => {
        settings.addSection('General').setName('Cycle Settings');
        settings.addSwitch('autoRotate')
          .setLabel('Auto Rotate Effects')
          .setValue(false)
          .setDesc('Automatically cycle through effects every 10 seconds');
      });

      // Apply initial settings
      await this.applyCurrentSettings();
      
    } catch (error) {
      console.error("Error during RGB Demo Plugin initialization:", error);
    }
  }

  /**
   * Apply current settings from config to RGB controller
   */
  async applyCurrentSettings() {
    const effect = (this.config.get('settings.effect', 'rainbow') ?? 'rainbow') as RGBEffect;
    const speed = this.config.get('settings.speed', 50) ?? 50;
    const brightness = this.config.get('settings.brightness', 100) ?? 100;
    const color = this.config.get('settings.color', '#FFFFFF') ?? '#FFFFFF';

    try {
      await this.device.rgb.setEffect(effect, speed, brightness, color);
      console.log(`Applied RGB: ${effect}, speed: ${speed}, brightness: ${brightness}, color: ${color}`);
    } catch (error) {
      console.error('Error applying RGB settings:', error);
    }
  }

  /**
   * Cycle to the next RGB effect
   */
  async cycleToNextEffect() {
    const effects = this.device.rgb.getAvailableEffects();
    this.currentEffectIndex = (this.currentEffectIndex + 1) % effects.length;
    const nextEffect = effects[this.currentEffectIndex];
    
    // Use saved settings for speed, brightness, and color
    const speed = this.config.get('settings.speed', 50) ?? 50;
    const brightness = this.config.get('settings.brightness', 100) ?? 100;
    const color = this.config.get('settings.color', '#FFFFFF') ?? '#FFFFFF';
    
    await this.device.rgb.setEffect(nextEffect, speed, brightness, color);
    this.config.set('settings.effect', nextEffect);
  }

  /**
   * Get the current effect name
   */
  getCurrentEffectName(): string {
    const effects = this.device.rgb.getAvailableEffects();
    return effects[this.currentEffectIndex] || 'rainbow';
  }

  /**
   * Start auto-testing mode - cycles through all effects automatically
   */
  startAutoTesting() {
    console.log('Starting auto-testing mode...');
    
    // Stop any existing interval
    this.stopAutoTesting();
    
    // Cycle through effects every 5 seconds
    this.autoTestInterval = setInterval(async () => {
      await this.cycleToNextEffect();
      const currentEffect = this.getCurrentEffectName();
      
      console.log(`Auto-testing effect: ${currentEffect}`);
    }, 5000);
  }

  /**
   * Stop auto-testing mode
   */
  stopAutoTesting() {
    if (this.autoTestInterval) {
      clearInterval(this.autoTestInterval);
      this.autoTestInterval = null;
      console.log('Auto-testing mode stopped');
    }
  }

  getConfig() {
    this.settings = this.config.get('settings');
  }

  saveSettings() {
    this.config.set('settings', this.settings);
  }

  initConfig() {
    this.config.init({
      schema: {
        settings: {
          type: "object",
          properties: {
            effect: {
              default: 'rainbow',
              description: 'The current RGB effect',
              type: 'string'
            },
            speed: {
              default: 50,
              description: 'Animation speed (0-100)',
              type: 'number'
            },
            brightness: {
              default: 100,
              description: 'LED brightness (0-100)',
              type: 'number'
            },
            color: {
              default: '#FFFFFF',
              description: 'RGB color in hex format',
              type: 'string'
            },
            rgbControlMode: {
              default: 'disabled',
              description: 'RGB control mode: disabled, hue, or rgb-mix',
              type: 'string'
            }
          }
        }
      }
    });
  }

  async onDeviceUpdate(data: any) {
    console.log("[RGB DEMO PLUGIN]: Device updated:", data);

    // Check RGB control mode
    const rgbControlMode = this.config.get('settings.rgbControlMode', 'disabled');
    
    if (rgbControlMode === 'disabled') {
      return; // Feature disabled, do nothing
    }

    if (rgbControlMode === 'hue') {
      // HUE MODE: Slider 0 controls hue (0-360)
      data.changes.forEach((change: any) => {
        if (change.index === 0) {
          // Map slider value (0-100) to hue (0-360)
          const hue = Math.floor((change.newValue / 100) * 360);
          const color = this.hslToHex(hue, 100, 50);
          
          console.log(`[Hue Mode] Slider 0 changed to ${change.newValue}, setting color to ${color}`);
          this.device.rgb.setColor(color);
        }
      });
    } else if (rgbControlMode === 'rgb-mix') {
      // RGB MIX MODE: Sliders 0, 1, 2 control R, G, B values
      // Use current slider values from data.sliders array
      
      // Slider 0 = Red (0-100 maps to 0-255)
      const r = Math.round((data.sliders[0] / 100) * 255);
      
      // Slider 1 = Green (0-100 maps to 0-255)
      const g = Math.round((data.sliders[1] / 100) * 255);
      
      // Slider 2 = Blue (0-100 maps to 0-255)
      const b = Math.round((data.sliders[2] / 100) * 255);

      // Convert to hex color
      const color = this.rgbToHex(r, g, b);
      
      console.log(`[RGB Mix Mode] R:${r}, G:${g}, B:${b} -> ${color}`);
      this.device.rgb.setColor(color);
    }
  }

  /**
   * Convert HSL to Hex color
   */
  hslToHex(h: number, s: number, l: number): string {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  /**
   * Convert RGB values to Hex color
   */
  rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => {
      const hex = Math.max(0, Math.min(255, n)).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  async onUnload() {
    console.log("RGB Demo Plugin shutting down...");
    // Stop auto-testing if running
    this.stopAutoTesting();
    // Turn off RGB lights when plugin unloads
    await this.device.rgb.turnOff();
  }
  
}

if (require.main === module) {
  runPlugin(RGBDemoPlugin);
}

