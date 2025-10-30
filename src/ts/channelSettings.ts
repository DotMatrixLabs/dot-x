import { Store } from "@tauri-apps/plugin-store";
import * as _ from "lodash"; // Make sure to import lodash if you haven't already
import { useDeckerStore } from "../store/deckerStore";

/**
 * Class for managing channel settings.
 */
class ChannelSettings {
    private store!: Store;

    /**
     * Creates an instance of ChannelSettings.
     */
    constructor() {
        // lazy init
        this.init();
    }

    private async ensureLoaded() {
        if (!this.store) {
            this.store = await Store.load("channelSettings.json");
        }
    }

    /**
     * Sets a key-value pair in the store.
     * @param {string} key - The key for the value.
     * @param {any} value - The value to be stored.
     */
    async set(key: string, value: any) {
        await this.ensureLoaded();
        await this.store.set(key, value);
        await this.save();
    }

    /**
     * Retrieves a value from the store.
     * @param {string} key - The key to retrieve the value.
     * @returns {Promise<any>} The stored value.
     */
    async get(key: string): Promise<any> {
        await this.ensureLoaded();
        return await this.store.get(key);
    }

    /**
     * Saves changes to the store.
     */
    async save() {
        await this.ensureLoaded();
        await this.store.save();
    }

    /**
     * init is used on startup to get the current settings from the local file, and push them to the pinia store
     */
    async init() {
        const channelSettings = await this.getAllChannelSettings();
        useDeckerStore().setChannelSettings(channelSettings);
    }


    async getAllChannelSettings(): Promise<any> {
        await this.ensureLoaded();
        let settingsObject: { [key: string]: any } = {};
        const keys = await this.store.keys();
        await Promise.all(keys.map(async (key) => {
            const value = await this.store.get(key);
            settingsObject[key] = value;
        }));
        
        return settingsObject;
    }

    async updateChannelSettings(channelId: number, key: string, value: any): Promise<any> {
        await this.ensureLoaded();
        //first get the current settings object for the channel
        let currentSettings = await this.getChannelSettings(channelId);
        //merge the current settings with the new settings
        let updatedSettings = _.merge(currentSettings, {[key]: value});
        //save the updated settings
        const channel = channelId.toString();

        await this.store.set(channel, updatedSettings);
        //save the store
        await this.store.save();
        //update the deckerStore
        useDeckerStore().updateChannelSetting(channel, updatedSettings);
        //return the updated settings
        return updatedSettings;
    }

    async getChannelSettings(channelId: number): Promise<any> {
        if(channelId === undefined) return; 
        await this.ensureLoaded();
        return await this.store.get(channelId.toString());
    }
    

}

export default new ChannelSettings();
