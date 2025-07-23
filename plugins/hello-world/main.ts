import Plugin, { runPlugin } from "../../plugin-sdk/src/index";

console.log("Hello World!");

export default class HelloWorldPlugin extends Plugin {
  async onLoad() {
    console.log("Hello World Plugin initializing...");
    
    try {
      // Wait a moment for connection to establish
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const settings = await this.settings.createSettings({
        schema: {
          hello: {
            type: "text",
            label: "Hello",
            placeholder: "Enter your greeting"
          },
          enabled: {
            type: "boolean",
            label: "Enable Plugin"
          }
        },
        options: {
          defaultTab: "hello",
          showTabIcons: true,
          tabPosition: "top",
          autoSave: true,
          validateOnChange: true,
          tabs: {
            hello: {
              title: "Hello",
              icon: "👋"
            }
          }
        }
      });

      // Set a default value after a delay
      setTimeout(async () => {
        try {
          await this.settings.setValue({
            key: "hello",
            value: "Hello from Socket.IO Plugin!"
          });
          console.log("Default value set successfully");
        } catch (error) {
          console.error("Error setting default value:", error);
        }
      }, 2000);
      
      await this.ui.showToast({
        message: "Socket.IO Plugin loaded successfully!",
        type: "success",
        duration: 3000
      });
      
      console.log("Plugin loaded successfully!");
      
    } catch (error) {
      console.error("Error during plugin initialization:", error);
      await this.ui.showToast({
        message: "Failed to load plugin: " + error.message,
        type: "error",
        duration: 5000
      });
    }
  }

  async onUnload() {
    console.log("Hello World Plugin shutting down...");
    await super.onUnload();
  }
}

if (require.main === module) {
  runPlugin(HelloWorldPlugin);
}