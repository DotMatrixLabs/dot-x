import { Store } from "tauri-plugin-store-api";
import * as _ from "lodash"; // Make sure to import lodash if you haven't already

/**
 * Class for managing extra apps and their configurations.
 */
class ExtraApps {
    private store: Store;

    /**
     * Creates an instance of ExtraApps.
     */
    constructor() {
        this.store = new Store("extraApps.json");
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
     * Adds an extra app with its configuration.
     * @param {string} name - The display name of the extra app.
     * @param {string} filePath - The installation location of the extra app.
     */
    async addExtraApp(name: string, filePath: string) {
        const extraApp = {
            DisplayName: name,
            InstallationLocation: filePath,
            AppType: 'custom',
        };

        const keyName = _.camelCase(name);

        await this.store.set(keyName, extraApp);

        await this.save();
    }


    /**
     * Retrieves all extra apps and their configurations.
     * @returns {Promise<any>} An array of extra apps and their configurations.
     */
    async getExtraApps(): Promise<any> {
        return await this.store.values();
    }
}

export default new ExtraApps();
