import createPlugin from "@extism/extism";
import { readDir } from '@tauri-apps/api/fs';
import { resolveResource } from '@tauri-apps/api/path'

class PluginManager {
    // private config: any;
    // private sliderValues: any;
    private plugins: any;

    public constructor() {
        // Initialize the config and sliderValues properties
        // this.config = {};
        // this.sliderValues = {};
        this.loadPlugins();
        this.plugins = {};
        console.log("Started plugin manager");
    }        


    async loadPlugins() {
        const plugins = await this.getAllFilesInResourceFolder();
        plugins.forEach((plugin) => {
            this.loadPlugin(plugin);
        })
    }
        


    private async loadPlugin(pluginData: any) {
        const { path, name } = pluginData;
        console.log("Plugin name: " + name + " path: " + path);
        const plugin = await createPlugin(
            'https://github.com/extism/plugins/releases/latest/download/count_vowels.wasm',
            { useWasi: true }
        );

        this.plugins[name] = plugin as any; // Add index signature to allow indexing with a string parameter

    }

    async getAllFilesInResourceFolder() {
        const resourcePath = await resolveResource('plugins')
        try {
            const files = await readDir(resourcePath);
            return files;
        } catch (error) {
            console.error('Error reading directory:', error);
            return [];
        }
    }
    



    // public getConfig(): any {
    //     return this.config;
    // }

    // public setConfig(config: any): void {
    //     this.config = config;
    // }

    // public updateSliderValues(sliderValues: any): void {
    //     this.sliderValues = sliderValues;
    // }
}

export default (new PluginManager());
