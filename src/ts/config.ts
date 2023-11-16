import { Store } from "tauri-plugin-store-api";
import { invoke } from "@tauri-apps/api/tauri";


class ConfigStore {
    private store: Store;

    constructor() {
        this.store = new Store("config.json");
    }

    async set(key: string, value: any) {
        await this.store.set(key, value);
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
        return await this.store.get(key);
    }

    async getTheme(): Promise<string> {
        return await invoke("plugin:theme|get_theme");
    }

    async save() {
        await this.store.save();
    }

}

export default new ConfigStore();

