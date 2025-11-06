import Plugin, { runPlugin } from "../../plugin-sdk/src/index";

export default class HelloWorldPlugin extends Plugin {

  private settings: any;

  async onLoad() {
    this.initConfig();
    this.getConfig();

    // ===== DEVICE MANAGEMENT DEMO =====
    
    // Check currently connected devices
    const devices = await this.device.getConnected();
    
    // Listen for device connections
    this.device.onConnect((device) => {
      this.ui.showToast({
        message: `${device.name} connected on ${device.port}`,
        type: 'success',
        duration: 3000
      });
    });
    
    // Listen for device disconnections
    this.device.onDisconnect((device) => {
      this.ui.showToast({
        message: `${device.name} disconnected`,
        type: 'warning',
        duration: 3000
      });
    });
    
    // Listen for device value updates (replaces onDeviceUpdate)
    this.device.onUpdate((data) => {
      // Process each change
      data.changes.forEach(change => {
        // Handle control changes here
      });
    });

    try {
      // Create a sectioned settings page using the imperative builder
      await this.settingsPage.addSettings((settings) => {
        
        // ===== DEVICE MONITORING SECTION =====
        const deviceSection = settings.addSection('Device Monitoring')
          .setName('🔌 Device Monitoring');

        // Update connection status badge based on device state
        const connectionStatus = settings.addBadge('connectionStatus')
          .setLabel('Device Connection Status')
          .setText(devices.length > 0 ? `Connected: ${devices[0].name}` : 'No device connected')
          .setDesc('Real-time device connection state using this.device API.')
          .setStyle(devices.length > 0 ? 'success' : 'error');

        // Update connection status when device connects/disconnects
        this.device.onConnect((device) => {
          connectionStatus.setText(`Connected: ${device.name}`);
          connectionStatus.setStyle('success');
        });
        
        this.device.onDisconnect(() => {
          connectionStatus.setText('No device connected');
          connectionStatus.setStyle('error');
        });

        // Show device port information
        if (devices.length > 0) {
          settings.addText('devicePort')
            .setLabel('Device Port')
            .setText(devices[0].port)
            .setDesc('COM port where the device is connected.');
        }

        // Button to manually check device connection
        settings.addButton('checkDevicesButton')
          .setTitle('Check Connected Devices')
          .onClick(async () => {
            const connectedDevices = await this.device.getConnected();
            
            if (connectedDevices.length > 0) {
              const deviceInfo = connectedDevices.map(d => `${d.name} (${d.port})`).join(', ');
              this.ui.showToast({
                message: `Connected: ${deviceInfo}`,
                type: 'success',
                duration: 4000
              });
            } else {
              this.ui.showToast({
                message: 'No devices connected',
                type: 'info',
                duration: 3000
              });
            }
          });

        // ===== GENERAL SECTION =====
        const general = settings.addSection('General');

        const currentTime = settings.addText('currentTime')
          .setLabel('Current Time')
          .setText(new Date().toLocaleTimeString())
          .setDesc('This is the current time.')
          .setStyle('info')

        const greeting = settings.addInput('customGreeting')
          .setType('ip_address')
          .setLabel('Broker IP')
          .setPlaceholder('Enter broker IP')
          .setValue(this.settings?.brokerIP || '192.168.1.1')
          .setRequired(true)
          .setDesc('This broker IP is used by the plugin when needed.')
          .onChange((data) => {
            greeting.setValue(data.value);
            this.config.set('settings.brokerIP', data.value);
          });

          const brokerPort = settings.addInput('brokerPort')
            .setType('number')
            .setLabel('Broker Port')
            .setPlaceholder('Enter broker port')
            .setValue(this.settings?.brokerPort || 1883)
            .setRequired(true)
            .setDesc('This broker port is used by the plugin when needed.')
            .onChange((data) => {
              brokerPort.setValue(data.value);
              this.config.set('settings.brokerPort', data.value);
            });

          const quality = settings.addSelect('quality')
            .setLabel('Quality')
            .setPlaceholder('Pick one')
            .setOptions([
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ])
            .setValue(this.settings?.quality || 'medium')
            .setDesc('Select processing quality')
            .onChange(({ value }) => {
              quality.setValue(value);
              this.config.set('settings.quality', value);
            });


        const demoSwitch = settings.addSwitch('demoSwitch')
          .setLabel('Expandable Section Switch')
          .setValue(this.settings?.demoSwitch || false)
          .onChange((data) => {
            advanced.setExpanded(data.value);
          });

          const hiddenSectionSwitch = settings.addSwitch('hiddenSectionSwitch')
          .setLabel('Hidden Section Switch')
          .setValue(this.settings?.hiddenSectionSwitch || false)
          .onChange((data) => {
            advanced.setHidden(data.value);
          });


        
          const disabledSwitch = settings.addSwitch('disabledSwitch')
          .setLabel('Disabled Section Switch')
          .setValue(this.settings?.disabledSwitch || false)
          .onChange((data) => {
            advanced.setDisabled(data.value);
          });

        settings.addButton('demoButton')
          .setTitle('Toggle Section')
          .onClick(() => {
            demoSwitch.setValue(true);
          });

        const advanced = settings.addSection('advanced')
          .setExpandable(true)
          .setName('Advanced')
        
        const debug = settings.addSwitch('debug')
          .setLabel('Debug Flag')
          .setValue(this.settings?.debug || false)
          .onChange((data) => {
            debug.setValue(data.value);
            greeting.setDisabled(data.value);
            this.config.set('settings.debug', data.value);
            this.ui.showToast({
              message: 'Debug flag changed to: ' + data.value,
              type: 'info',
            });
          });
      });


      const boltButton = this.actionmapper
        .addSystemUtilButton('bolt')
        .setTitle('Boltt')
        .setIcon('fas fa-lg fa-bolt')
        .onClick(({ selected, channel }) => {
          this.ui.showToast({ message: `Hello on ch ${channel} (${selected ? 'ON' : 'OFF'})`, type: 'success' });
        })

        // Add settings to the bolt button
        boltButton.addSettings((settings) => {
          settings.addSection('General').setName('General')
          settings.addSwitch('enabled').setLabel('Enable EQ').setValue(true)
            .setDesc('Toggle the equalizer');
        });
      
    } catch (error) {
      console.error("Error during plugin initialization:", error);
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
            brokerIP: {
              default: '192.168.1.1',
              description: 'The broker IP to use when interacting with the plugin.',
              type: 'string'
            }
          }
        }
      }
    });
  }

  async onUnload() {
    // Cleanup code here
  }
  
}



if (require.main === module) {
  runPlugin(HelloWorldPlugin);
}