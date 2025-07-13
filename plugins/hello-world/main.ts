import Plugin from "../../plugin-sdk/src/index";

export default class HelloWorldPlugin extends Plugin {
  async onLoad() {

    const settingsButton = await this.settings.addButton({
      title: "Test Button"
    });
    
    settingsButton.onPress(() => {
      console.log("Button pressed!");
    });
    
    await this.ui.showNotification("Plugin loaded!");
  }
}