import Plugin, { runPlugin } from "../../plugin-sdk/src/index";


console.log("Hello World!");

export default class HelloWorldPlugin extends Plugin {
  async onLoad() {

    const settings = await this.settings.createSettings({
      schema: {
        hello: {
          type: "text",
          label: "Hello"
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

    setTimeout(async () => {
      await this.settings.setValue({
        key: "hello",
        value: "Hello World!"
      });
    }, 5000);
    
    await this.ui.showToast({
      message: "Plugin loaded!",
      type: "success",
      duration: 3000
    });
  }
}

if (require.main === module) {
  runPlugin(HelloWorldPlugin);
}