import Plugin, { runPlugin } from "../../plugin-sdk/src/index";

console.log("Hello World!");

export default class HelloWorldPlugin extends Plugin {
  async onLoad() {
    console.log("Hello World Plugin loaded!");
    
    try {
      this.testToast();
      
      console.log("Plugin loaded successfully!");
      
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