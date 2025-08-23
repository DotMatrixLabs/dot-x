import Plugin, { runPlugin } from "../../plugin-sdk/src/index";

console.log("Hello World!");

export default class HelloWorldPlugin extends Plugin {
  async onLoad() {
    console.log("Hello World Plugin loaded!");
    
    try {
      // Create a sectioned settings page using the imperative builder
      await this.createSettingsPage((s) => {
        s.addSection('General');

        const greeting = s.addText('greeting')
          .setLabel('Greeting')
          .setPlaceholder('Enter greeting')
          .setValue('Hello DotX!')
          .setDesc('This greeting is used by the plugin when needed.')
          .onChange((data) => {
            console.log('Greeting changed:', data.value);
            demoButton.setTitle(data.value);
          });

        const demoButton = s.addButton('demoButton')
          .setTitle('Log Message')
          .setOnClick(() => {
            console.log('Button clicked!');
            greeting.setValue('Button clicked!');
          });

        s.addSection('Advanced');
        
        const debug = s.addText('debug')
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

  async onUnload() {
    console.log("Hello World Plugin shutting down...");
  }
  
}



if (require.main === module) {
  runPlugin(HelloWorldPlugin);
}