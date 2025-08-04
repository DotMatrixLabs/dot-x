import Plugin, { runPlugin } from "../../plugin-sdk/src/index";

console.log("Hello World!");

export default class HelloWorldPlugin extends Plugin {
  async onLoad() {
    console.log("Hello World Plugin loaded!");
    
    try {
      // Create settings with a button
      await this.settings.createSettings({
        schema: {
          demoButton: {
            type: 'button',
            label: 'Show Toast',
            text: 'Click me',
            style: 'primary',
            onClick: () => {
              this.ui.showToast({
                message: 'Button clicked!',
                type: 'success',
                duration: 3000
              });
            }
          }
        }
      });
      
      console.log("Plugin settings created successfully!");
      
    } catch (error) {
      console.error("Error during plugin initialization:", error);
    }
  }

  async onUnload() {
    console.log("Hello World Plugin shutting down...");
  }

  /**
   * Example method to show a toast from the plugin.
   */
  testToast() {
    this.ui.showToast({
      message: "Hello World",
      type: "success",
      duration: 3000
    });
  }

  
}



if (require.main === module) {
  runPlugin(HelloWorldPlugin);
}