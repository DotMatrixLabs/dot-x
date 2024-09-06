import { Store } from "tauri-plugin-store-api";
import * as _ from "lodash"; // Make sure to import lodash if you haven't already
import { useDeckerStore } from "../store/deckerStore";

/**
 * Class for managing channel settings.
 */
class ChannelSettings {
    private store: Store;

    /**
     * Creates an instance of ChannelSettings.
     */
    constructor() {
        this.store = new Store("channelSettings.json");
        this.getAllChannelSettings();
        this.init();
    }

    /**
     * Sets a key-value pair in the store.
     * @param {string} key - The key for the value.
     * @param {any} value - The value to be stored.
     */
    async set(key: string, value: any) {
        await this.store.set(key, value);
    }

    /**
     * Retrieves a value from the store.
     * @param {string} key - The key to retrieve the value.
     * @returns {Promise<any>} The stored value.
     */
    async get(key: string): Promise<any> {
        return await this.store.get(key);
    }

    /**
     * Saves changes to the store.
     */
    async save() {
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
        let settingsObject: { [key: string]: any } = {};
        const keys = await this.store.keys();
        keys.forEach(async (key) => {
            const value = await this.store.get(key);
            settingsObject[key] = value;
        });
        
        return settingsObject;
    }

    async updateChannelSettings(channelId: number, key: string, value: any): Promise<any> {
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
        const ID = channelId.toString();
        return await this.store.get(ID);
    }
    

}

export default new ChannelSettings();
