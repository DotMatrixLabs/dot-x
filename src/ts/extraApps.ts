import { Store } from "tauri-plugin-store-api";
import * as _ from "lodash"; // Make sure to import lodash if you haven't already
class ExtraApps {
    private store: Store;

    constructor() {
        this.store = new Store("extraApps.json");
    }

    async set(key: string, value: any) {
        await this.store.set(key, value);
    }

    async get(key: string): Promise<any> {
        return await this.store.get(key);
    }

    async save() {
        await this.store.save();
    }

    async addExtraApp(name: string, filePath: string) {
        const extraApp = {
            DisplayName: name,
            InstallationLocation: filePath,
            AppType: 'custom',
        };

        const keyName = _.camelCase(name);

        await this.store.set(`extraApps.${keyName}`, extraApp);

        await this.save();
    }

    async removeExtraApp(name: string) {
        const keyName = _.camelCase(name);

        await this.store.remove(`extraApps.${keyName}`);

        await this.save();
    }

    async getExtraApps(): Promise<any> {
        return await this.store.values();
    }

}

export default new ExtraApps();
