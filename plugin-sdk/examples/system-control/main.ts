import { initPluginFromManifest } from '../../api/index';

async function main() {
  try {
    // Initialize plugin from manifest.json
    const api = await initPluginFromManifest('./manifest.json');
    
    console.log('System Control Plugin initialized!');
    await api.logs.info('System Control Plugin started successfully');

    // Register RGB control commands
    await api.commands.register({
      id: 'system-control.rgb.set-red',
      name: 'Set RGB Red',
      description: 'Sets RGB lighting to red',
      hotkey: 'Ctrl+R',
      icon: 'fas fa-circle',
      callback: async () => {
        await api.rgb.setRGB({ r: 255, g: 0, b: 0 });
        await api.toasts.show('RGB set to red! 🔴', {
          type: 'success',
          duration: 2000
        });
        await api.logs.info('RGB color changed to red');
      }
    });

    await api.commands.register({
      id: 'system-control.rgb.set-green',
      name: 'Set RGB Green',
      description: 'Sets RGB lighting to green',
      hotkey: 'Ctrl+G',
      icon: 'fas fa-circle',
      callback: async () => {
        await api.rgb.setRGB({ r: 0, g: 255, b: 0 });
        await api.toasts.show('RGB set to green! 🟢', {
          type: 'success',
          duration: 2000
        });
        await api.logs.info('RGB color changed to green');
      }
    });

    await api.commands.register({
      id: 'system-control.rgb.set-blue',
      name: 'Set RGB Blue',
      description: 'Sets RGB lighting to blue',
      hotkey: 'Ctrl+B',
      icon: 'fas fa-circle',
      callback: async () => {
        await api.rgb.setRGB({ r: 0, g: 0, b: 255 });
        await api.toasts.show('RGB set to blue! 🔵', {
          type: 'success',
          duration: 2000
        });
        await api.logs.info('RGB color changed to blue');
      }
    });

    // Register RGB effect commands
    await api.commands.register({
      id: 'system-control.rgb.rainbow',
      name: 'RGB Rainbow Effect',
      description: 'Activates rainbow RGB effect',
      hotkey: 'Ctrl+Shift+R',
      icon: 'fas fa-rainbow',
      callback: async () => {
        await api.rgb.setEffect({
          type: 'rainbow',
          speed: 50,
          brightness: 80
        });
        await api.toasts.show('Rainbow effect activated! 🌈', {
          type: 'success',
          duration: 3000
        });
        await api.logs.info('RGB effect changed to rainbow');
      }
    });

    await api.commands.register({
      id: 'system-control.rgb.breathing',
      name: 'RGB Breathing Effect',
      description: 'Activates breathing RGB effect',
      hotkey: 'Ctrl+Shift+B',
      icon: 'fas fa-lungs',
      callback: async () => {
        const currentColor = await api.rgb.getRGB();
        await api.rgb.setEffect({
          type: 'breathing',
          speed: 30,
          brightness: 70,
          colors: [currentColor]
        });
        await api.toasts.show('Breathing effect activated! 💨', {
          type: 'success',
          duration: 3000
        });
        await api.logs.info('RGB effect changed to breathing');
      }
    });

    // Add ActionSelector tab
    await api.actionSelector.addTab({
      id: 'rgb-control',
      name: 'RGB Control',
      icon: 'fas fa-palette',
      order: 100
    });

    // Add system utility
    await api.actionSelector.addSystemUtility({
      id: 'rgb-toggle',
      name: 'Toggle RGB',
      icon: 'fas fa-lightbulb',
      action: 'toggle-rgb',
      order: 1
    });

    // Add Settings tab
    await api.settings.addTab({
      id: 'rgb-settings',
      name: 'RGB Settings',
      icon: 'fas fa-cogs',
      inputs: [
        {
          id: 'default-color',
          type: 'color',
          label: 'Default Color',
          value: '#ffffff',
          description: 'Default RGB color when plugin loads'
        },
        {
          id: 'brightness',
          type: 'range',
          label: 'Default Brightness',
          value: 80,
          min: 0,
          max: 100,
          step: 5,
          description: 'Default brightness level (0-100%)'
        },
        {
          id: 'auto-enable',
          type: 'boolean',
          label: 'Auto-enable on startup',
          value: true,
          description: 'Automatically enable RGB when plugin loads'
        },
        {
          id: 'effect-speed',
          type: 'range',
          label: 'Default Effect Speed',
          value: 50,
          min: 1,
          max: 100,
          step: 1,
          description: 'Default speed for RGB effects'
        }
      ],
      order: 100
    });

    // Add TopBar button
    await api.topBar.addButton({
      id: 'rgb-status',
      icon: 'fas fa-palette',
      tooltip: 'RGB Status',
      action: 'rgb-status',
      order: 1
    });

    // Set up event listeners
    api.listeners.onSliderChange((event) => {
      console.log('Slider changed:', event);
      // Handle slider changes for RGB brightness control
      if (event.sliderId === 'rgb-brightness') {
        api.rgb.setRGB({ r: event.value * 2.55, g: event.value * 2.55, b: event.value * 2.55 });
      }
    });

    api.listeners.onDeviceConnected((device) => {
      console.log('Device connected:', device);
      if (device.deviceType === 'rgb') {
        api.toasts.show(`RGB device connected: ${device.deviceName}`, {
          type: 'success',
          duration: 3000
        });
      }
    });

    api.listeners.onDeviceDisconnected((device) => {
      console.log('Device disconnected:', device);
      if (device.deviceType === 'rgb') {
        api.toasts.show(`RGB device disconnected: ${device.deviceName}`, {
          type: 'warning',
          duration: 3000
        });
      }
    });

    // Initialize plugin settings
    const autoEnable = await api.storage.get('system-control.rgb.auto-enable') ?? true;
    if (autoEnable) {
      const defaultColor = await api.storage.get('system-control.rgb.default-color') ?? { r: 255, g: 255, b: 255 };
      await api.rgb.setRGB(defaultColor);
    }

    // Show initialization toast
    await api.toasts.show('System Control Plugin loaded successfully!', {
      type: 'success',
      duration: 2000
    });

    // Set up cleanup on plugin unload
    globalThis.addEventListener('beforeunload', async () => {
      await api.logs.info('System Control Plugin shutting down...');
      
      // Clean up commands
      await api.commands.unregister('system-control.rgb.set-red');
      await api.commands.unregister('system-control.rgb.set-green');
      await api.commands.unregister('system-control.rgb.set-blue');
      await api.commands.unregister('system-control.rgb.rainbow');
      await api.commands.unregister('system-control.rgb.breathing');
      
      await api.destroy();
    });

  } catch (error) {
    console.error('Failed to initialize System Control Plugin:', error);
  }
}

// Start the plugin
main(); 