import { Store } from "tauri-plugin-store-api";
import * as _ from "lodash";
import ConfigStore from "./config";
import { useDeckerStore } from "../store/deckerStore";

/**
 * Class representing selected apps.
 */
class SelectedApps {
    private store: Store;

    /**
     * Creates an instance of SelectedApps.
     */
    constructor() {
        this.store = new Store("selectedApps.json");
    }

    async init() {
        const keys = await this.store.keys();
        const allApps: Record<string, string[]> = {};
        for (const key of keys) {
            const apps = await this.store.get<string[]>(key);
            if (apps) {
                allApps[key] = apps;
            }
        }
        useDeckerStore().setAllMappedApps(allApps);

        const volumeSyncEnabled = await ConfigStore.get("volumeSyncEnabled") || false;
        useDeckerStore().setVolumeSyncEnabled(volumeSyncEnabled);
    }

    /**
     * Toggles the specified apps or devices for a slider.
     * @param {string} sliderID - The ID of the slider.
     * @param {string | string[]} appNames - The name or array of names of the app(s) or device(s) to toggle.
     */
    async toggleApps(sliderID: string, appNames: string | string[]) {
        console.log("toggleApps", sliderID, appNames);

        const key: string = sliderID.toString();
        const currentApps: string[] = (await this.store.get<string[]>(key)) || [];

        if (!Array.isArray(appNames)) {
            appNames = [appNames];
        }

        const updatedApps: string[] = _.xor(currentApps, appNames);

        await this.store.set(key, updatedApps);
        await this.store.save();

        useDeckerStore().setMappedApps(key, updatedApps);
    }

    /**
     * Gets the apps and devices for a specific slider.
     * @param {number} sliderID - The ID of the slider.
     * @returns {Promise<string[] | null>} The apps and devices for the slider, or null if not found.
     */
    async getApps(sliderID: number): Promise<string[] | null> {
        const sliderIDString = sliderID?.toString();
        if (!sliderIDString) return null;
        return await this.store.get(sliderIDString);
    }

    /**
     * Gets all of the mapped apps
     * @returns {Promise<string[] | null>} The apps for the slider, or null if not found.
     */
    async getMappedApps(): Promise<string[] | null> {
        let mappedApps: string[] = [];
        //get number of sliders by looking at number of keys in store
        const keys = await this.store.keys();
        const numSliders = keys.length;
        for (let i = 0; i < numSliders; i++) {
            const apps = await this.getApps(i);
            if (!apps) continue;
            mappedApps = [...mappedApps, ...apps];
        }
        return mappedApps;
    }

    /**
     * Saves the changes to the store.
     */
    async save() {
        await this.store.save();
    }
}

export default new SelectedApps();
