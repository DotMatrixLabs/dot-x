import { Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";


class ConfigStore {
    private store!: Store;

    constructor() {
    }

    private async ensureLoaded() {
        if (!this.store) {
            this.store = await Store.load("config.json");
        }
    }

    async set(key: string, value: any) {
        await this.ensureLoaded();
        await this.store.set(key, value);
        await this.save();
    }

    /**
     * Set the theme for the application.
     *
     * @param {string} theme - The desired theme. Valid options are 'light', 'dark', or 'auto'.
     * @returns {Promise<void>} - A Promise that resolves once the theme is set.
     */
    async setTheme(theme: string) {
        invoke("plugin:theme|set_theme", {
            theme: theme,
        });
    }

    async get(key: string): Promise<any> {
        await this.ensureLoaded();
        return await this.store.get(key);
    }

    async delete(key: string) {
        await this.ensureLoaded();
        await this.store.delete(key);
    }

    async has(key: string) {
        await this.ensureLoaded();
        return await this.store.has(key);
    }


    async getTheme(): Promise<string> {
        return await invoke("plugin:theme|get_theme");
    }

    async save() {
        await this.ensureLoaded();
        await this.store.save();
    }

}

export default new ConfigStore();

