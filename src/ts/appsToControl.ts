import { Store } from "@tauri-apps/plugin-store";
import * as _ from "lodash";

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

    /**
     * Toggles the specified apps for a slider.
     * @param {string} sliderID - The ID of the slider.
     * @param {string | string[]} appNames - The name or array of names of the app(s) to toggle.
     */
    async toggleApps(sliderID: string, appNames: string | string[]) {
        console.log("toggleApps", sliderID, appNames);

        const key: string = sliderID.toString();
        const currentApps: string[] = (await this.store.get(key)) || [];

        if (!Array.isArray(appNames)) {
            appNames = [appNames];
        }

        const updatedApps: string[] = _.xor(currentApps, appNames);

        this.store.set(key, updatedApps);
        await this.store.save();
    }

    /**
     * Gets the apps for a specific slider.
     * @param {number} sliderID - The ID of the slider.
     * @returns {Promise<string[] | null>} The apps for the slider, or null if not found.
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
