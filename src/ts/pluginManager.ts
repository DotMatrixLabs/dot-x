import createPlugin from "@extism/extism";
import { readDir } from '@tauri-apps/api/fs';
import { resolveResource } from '@tauri-apps/api/path'
import { readBinaryFile } from '@tauri-apps/api/fs';

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


    async getPlugins() {
        const plugins = await this.getAllFilesInResourceFolder();
        return plugins;
    }
        


    private async loadPlugin(pluginData: any) {
        let { path, name } = pluginData;
        path = path.replace(/\\/g, '/'); // Replace backslashes with forward slashes
        path = path.replace('//?/', ''); // Remove the prefix
        console.log("Plugin name: " + name + " path: " + path);
        try {
            const ArrayBuffer = await this.loadFileAsArrayBuffer(path);
            if (ArrayBuffer) {
                const plugin = await createPlugin(
                    ArrayBuffer,
                    { useWasi: true }
                );
                this.plugins[name] = plugin as any; // Add index signature to allow indexing with a string parameter
                console.log('Loaded plugin:', name);
                console.log(this.plugins)
            } else {
                console.error('Error loading file:', name);
            }
        } catch (error) {
            console.error('Error loading plugin:', name, error);
        }
    }

    async loadFileAsArrayBuffer(filePath: string): Promise<ArrayBuffer | null> {
        try {
            const fileData = await readBinaryFile(filePath);
            return fileData.buffer;
        } catch (error) {
            console.error('Error loading file:', error);
            return null;
        }
    }


    async getAllFilesInResourceFolder() {
        const resourcePath = await resolveResource('plugins')
        try {
            const files = await readDir(resourcePath);
            console.log('Files in resource folder:', files);
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

    public updateSliderValues(sliderValues: any): void {
        console.log("Updating slider values", sliderValues);
        console.log(this.plugins);
        Object.values(this.plugins).forEach((plugin: any, index) => {
            // plugin.call("updateSliderValues", sliderValue, index).then(response => {
            //     console.log("Response from plugin", Object.keys(this.plugins)[index], response.string());
            // })
            // .catch((error: any) => {
            //     console.log('Error updating slider values for plugin', Object.keys(this.plugins)[index]);
            // })
        });
    }
}

export default (new PluginManager());
