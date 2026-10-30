import { Store } from "@tauri-apps/plugin-store";
import * as _ from "lodash";
import ConfigStore from "./config";
import { useDeckerStore } from "../store/deckerStore";
import { flattenMappedApps } from "./mappingUtils";
import { createLogger } from "./logger";

const log = createLogger("mapped-apps");

/**
 * Class representing selected apps.
 */
class SelectedApps {
    private store!: Store;
    private initPromise: Promise<void> | null = null;

    /**
     * Creates an instance of SelectedApps.
     */
    constructor() {
    }

    private async ensureLoaded() {
        if (!this.store) {
            this.store = await Store.load("selectedApps.json");
        }
    }

    /**
     * Mirrors the persisted mappings into the decker store. Safe to call more than once,
     * every call returns the same in-flight promise.
     */
    async init(): Promise<void> {
        if (!this.initPromise) {
            this.initPromise = this.hydrate().catch((error) => {
                // Drop the cached promise, otherwise one failed startup read would reject
                // every later mapping change that waits on it.
                this.initPromise = null;
                throw error;
            });
        }
        return this.initPromise;
    }

    /**
     * Resolves once the persisted mappings are in the decker store. Anything that reads
     * or writes the mirrored mappings has to await this first, otherwise it either works
     * off an empty mapping or gets overwritten by the hydration snapshot.
     * @returns {Promise<void>} A promise that resolves when the mappings are hydrated.
     */
    async ready(): Promise<void> {
        return this.init();
    }

    private async hydrate(): Promise<void> {
        const allApps = await this.getAllMappings();
        await useDeckerStore().setAllMappedApps(allApps);

        const volumeSyncEnabled = await ConfigStore.get("volumeSyncEnabled") || false;
        await useDeckerStore().setVolumeSyncEnabled(volumeSyncEnabled);
    }

    private async getAllMappings(): Promise<Record<string, string[]>> {
        await this.ensureLoaded();
        const keys = await this.store.keys();
        const allApps: Record<string, string[]> = {};
        for (const key of keys) {
            const apps = await this.store.get<string[]>(key);
            if (apps) {
                allApps[key] = apps;
            }
        }
        return allApps;
    }

    /**
     * Toggles the specified apps or devices for a slider.
     * @param {string} sliderID - The ID of the slider.
     * @param {string | string[]} appNames - The name or array of names of the app(s) or device(s) to toggle.
     */
    async toggleApps(sliderID: string, appNames: string | string[]) {
        await this.ensureLoaded();

        // Wait for the hydration snapshot, so this selection isn't overwritten by it. A failed
        // hydration must not swallow the selection: the store below is the source of truth,
        // and the next call retries hydration and picks this write up.
        await this.ready().catch((error) => log.error("Failed to load mapped apps", error));

        const key: string = sliderID.toString();
        const currentApps: string[] = (await this.store.get<string[]>(key)) || [];

        if (!Array.isArray(appNames)) {
            appNames = [appNames];
        }

        const updatedApps: string[] = _.xor(currentApps, appNames);

        await this.store.set(key, updatedApps);
        await this.store.save();

        await useDeckerStore().setMappedApps(key, updatedApps);
    }

    /**
     * Gets the apps and devices for a specific slider.
     * @param {number} sliderID - The ID of the slider.
     * @returns {Promise<string[] | null>} The apps and devices for the slider, or null if not found.
     */
    async getApps(sliderID: number): Promise<string[] | null> {
        await this.ensureLoaded();
        const sliderIDString = sliderID?.toString();
        if (!sliderIDString) return null;
        const result = await this.store.get(sliderIDString);
        return (result ?? null) as string[] | null;
    }

    /**
     * Gets the selected channel targets for a specific slider.
     * Channel targets can be apps, devices, or system features.
     * @param {number | string} sliderID - The ID of the slider.
     * @returns {Promise<string[]>} The channel targets for the slider, or an empty array if not found.
     */
    async getChannelTargets(sliderID: number | string): Promise<string[]> {
        await this.ensureLoaded();
        const sliderIDString = sliderID?.toString();
        if (!sliderIDString) return [];
        const result = await this.store.get(sliderIDString);
        return Array.isArray(result) ? result as string[] : [];
    }

    /**
     * Gets selected channel targets for every stored channel.
     * Channel targets can be apps, devices, or system features.
     * @returns {Promise<Record<string, string[]>>} Channel targets keyed by channel ID.
     */
    async getAllChannelTargets(): Promise<Record<string, string[]>> {
        await this.ensureLoaded();
        const channels: Record<string, string[]> = {};
        const keys = await this.store.keys();

        for (const key of keys) {
            const result = await this.store.get(key);
            channels[key] = Array.isArray(result) ? result as string[] : [];
        }

        return channels;
    }

    /**
     * Gets all of the mapped apps
     * @returns {Promise<string[] | null>} The apps for the slider, or null if not found.
     */
    async getMappedApps(): Promise<string[] | null> {
        return flattenMappedApps(await this.getAllMappings());
    }

    /**
     * Saves the changes to the store.
     */
    async save() {
        await this.ensureLoaded();
        await this.store.save();
    }
}

export default new SelectedApps();
