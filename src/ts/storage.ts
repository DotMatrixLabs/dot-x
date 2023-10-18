import { Store } from "tauri-plugin-store-api";

class TauriStore {
  private store: Store;

  constructor() {
    this.store = new Store("settings.txt");
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

export default new TauriStore();
