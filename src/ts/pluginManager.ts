

class PluginManager {
    private config: any;
    private sliderValues: any;
    private plugins: any;

    public constructor() {
        // Initialize the config and sliderValues properties
        this.config = {};
        this.sliderValues = {};
        this.loadPlugin('test');
        this.plugins = {};
    }


    private async loadPlugin(id: string) {
        const createPlugin = require("@extism/extism")

        const plugin = await createPlugin(
            'https://github.com/extism/plugins/releases/latest/download/count_vowels.wasm',
            { useWasi: true }
        );

        this.plugins[id] = plugin as any; // Add index signature to allow indexing with a string parameter

    }


    public getConfig(): any {
        return this.config;
    }

    public setConfig(config: any): void {
        this.config = config;
    }

    public updateSliderValues(sliderValues: any): void {
        this.sliderValues = sliderValues;
    }
}

export default (new PluginManager());
