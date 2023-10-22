import { Store } from "tauri-plugin-store-api";
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
     * Toggles the specified app for a slider.
     * @param {string} sliderID - The ID of the slider.
     * @param {string} appName - The name of the app to toggle.
     */
    async toggleApp(sliderID: string, appName: string) {
        const key = sliderID.toString();
        const currentApps: string[] | null = await this.store.get(key);
        if (!currentApps) await this.store.set(key, [appName]);
        else if (_.includes(currentApps, appName)) {
            let applications = _.pull(currentApps, appName);
            this.store.set(key, applications);
        } else {
            let applications = [...currentApps, appName];
            await this.store.set(key, applications);
        }
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
     * Saves the changes to the store.
     */
    async save() {
        await this.store.save();
    }
}

export default new SelectedApps();
