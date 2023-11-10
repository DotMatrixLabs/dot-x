import { Store } from "tauri-plugin-store-api";
class ConfigStore {
    private store: Store;

    constructor() {
        this.store = new Store("config.json");
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

}

export default new ConfigStore();
