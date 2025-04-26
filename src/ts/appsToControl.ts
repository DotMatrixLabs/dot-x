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
     * Gets the selected output devices for a specific slider.
     * @param {string} sliderID - The ID of the slider.
     * @returns {Promise<string[]>} The selected output devices for the slider, or empty array if not found.
     */
    async getOutputDevices(sliderID: string): Promise<string[]> {
        const key = `output_devices_${sliderID}`;
        return (await this.store.get(key)) || [];
    }

    /**
     * Sets the selected output devices for a specific slider.
     * @param {string} sliderID - The ID of the slider.
     * @param {string[]} devices - The array of selected output devices.
     */
    async setOutputDevices(sliderID: string, devices: string[]): Promise<void> {
        const key = `output_devices_${sliderID}`;
        await this.store.set(key, devices);
        await this.store.save();
    }

    /**
     * Gets the selected input devices for a specific slider.
     * @param {string} sliderID - The ID of the slider.
     * @returns {Promise<string[]>} The selected input devices for the slider, or empty array if not found.
     */
    async getInputDevices(sliderID: string): Promise<string[]> {
        const key = `input_devices_${sliderID}`;
        return (await this.store.get(key)) || [];
    }

    /**
     * Sets the selected input devices for a specific slider.
     * @param {string} sliderID - The ID of the slider.
     * @param {string[]} devices - The array of selected input devices.
     */
    async setInputDevices(sliderID: string, devices: string[]): Promise<void> {
        const key = `input_devices_${sliderID}`;
        await this.store.set(key, devices);
        await this.store.save();
    }

    /**
     * Saves the changes to the store.
     */
    async save() {
        await this.store.save();
    }
}

export default new SelectedApps();
