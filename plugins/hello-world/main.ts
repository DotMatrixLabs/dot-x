import Plugin, { runPlugin } from "../../plugin-sdk/src/index";

console.log("Hello World!");

export default class HelloWorldPlugin extends Plugin {
  private settings: any;

  async onLoad() {
    console.log("Hello World Plugin loaded!");

    this.initConfig();
    this.getConfig();

    try {
      // Create a sectioned settings page using the imperative builder
      await this.createSettingsPage((settings) => {
        const general = settings.addSection('General');


        const connectionStatus = settings.addBadge('connectionStatus')
          .setLabel('Connection Status')
          .setText(this.settings?.connectionStatus || 'Disconnected')
          .setDesc('This connection status is used by the plugin when needed.')
          .setStyle('success')

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
            console.log('Broker IP changed:', data.value);
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
              console.log('Broker port changed:', data.value);
              brokerPort.setValue(data.value);
              this.config.set('settings.brokerPort', data.value);
            });


        const demoSwitch = settings.addSwitch('demoSwitch')
          .setLabel('Demo Switch')
          .setValue(this.settings?.demoSwitch || false)
          .onChange((data) => {
            advanced.setExpanded(data.value);
            console.log('Demo switch changed:', data.value);
            demoSwitch.setValue(data.value);
            this.config.set('settings.demoSwitch', data.value);
          });

        settings.addButton('demoButton')
          .setTitle('Log Message')
          .onClick(() => {
            console.log('Button clicked!');
            demoSwitch.setValue(true);
          });

        const advanced = settings.addSection('advanced')
          .setExpandable(true)
          .setName('Advanced')
        
        const debug = settings.addSwitch('debug')
          .setLabel('Debug Flag')
          .setValue(this.settings?.debug || false)
          .onChange((data) => {
            console.log('Debug flag changed:', data.value);
            debug.setValue(data.value);
            greeting.setDisabled(data.value);
            this.config.set('settings.debug', data.value);
            this.ui.showToast({
              message: 'Debug flag changed to: ' + data.value,
              type: 'info',
            });
          });
      });
      
      console.log("Plugin settings created successfully!");


      const helloWorldButton = this.actionmapper
        .addSystemUtilButton('helloWorld')
        .setTitle('Hello')
        .setIcon('fas fa-lg fa-bolt')
        .setSelected(this.settings?.helloWorldChannels || [])
        .onClick(({selected, channel}) => {
          console.log('selected', selected);
          console.log('channel', channel);
          channel = Number(channel);
          if (!Array.isArray(this.settings.helloWorldChannels)) {
            this.settings.helloWorldChannels = [] as boolean[];
          }
          this.settings.helloWorldChannels[channel] = selected;
          helloWorldButton.setSelected(this.settings.helloWorldChannels || []);
          this.saveSettings();
          this.ui.showToast({ message: 'Hello from Slider Action!', type: 'success' });
        })  .withSettings((s) => {
          s.addSection('General')
            .addSwitch('enabled').setLabel('Enable EQ').setValue(true)
            .setDesc('Toggle the equalizer');
      
          s.addSection('Levels')
            .addInput('gain', { type: 'number' }).setLabel('Gain (dB)').setMin(-12).setMax(12)
            .setValue(0);
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

  async onDeviceUpdate(data: any) {
    console.log("[HELLO WORLD PLUGIN??]: Device updated:", data);

    // Process the device changes
    data.changes.forEach(change => {
      console.log(`Slider ${change.index} changed from ${change.oldValue} to ${change.newValue}`);
    });
  }

  async onUnload() {
    console.log("Hello World Plugin shutting down...");
  }
  
}



if (require.main === module) {
  runPlugin(HelloWorldPlugin);
}