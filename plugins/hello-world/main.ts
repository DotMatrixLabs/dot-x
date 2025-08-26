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
        settings.addSection('General');

        const greeting = settings.addText('customGreeting')
          .setLabel('Greeting')
          .setPlaceholder('Enter greeting')
          .setValue(this.settings?.greeting || 'Hello DotX!')
          .setDesc('This greeting is used by the plugin when needed.')
          .onChange((data) => {
            console.log('Greeting changed:', data.value);
            this.config.set('settings.greeting', data.value);
          });

        const demoButton = settings.addButton('demoButton')
          .setTitle('Log Message')
          .setOnClick(() => {
            console.log('Button clicked!');
            greeting.setValue('Button clicked!');
          });

        settings.addSection('Advanced');
        
        const debug = settings.addText('debug')
          .setLabel('Debug Flag')
          .setPlaceholder('true/false')
          .setValue('false')
          .onChange((data) => {
            console.log('Debug flag changed:', data.value);
            this.ui.showToast({
              message: 'Debug flag changed to: ' + data.value,
              type: 'info',
            });
          });
      });
      
      console.log("Plugin settings created successfully!");
      
    } catch (error) {
      console.error("Error during plugin initialization:", error);
    }
  }

  getConfig() {
    this.settings = this.config.get('settings');
  }

  initConfig() {
    this.config.init({
      schema: {
        settings: {
          type: "object",
          properties: {
            greeting: {
              default: 'Greetings!',
              description: 'The greeting to use when interacting with the plugin.',
              type: 'string'
            }
          }
        }
      }
    });
  }

  async onUnload() {
    console.log("Hello World Plugin shutting down...");
  }
  
}



if (require.main === module) {
  runPlugin(HelloWorldPlugin);
}