import { Store } from "tauri-plugin-store-api";

class PluginsStore {
  private store: Store;

  constructor() {
    this.store = new Store("plugins.json");
  }

  async save() {
    await this.store.save();
  }

  async getEnabledPluginIds(): Promise<string[]> {
    const value = await this.store.get("enabled");
    if (Array.isArray(value)) {
      return value as string[];
    }
    return [];
  }

  async setEnabledPluginIds(pluginIds: string[]): Promise<void> {
    await this.store.set("enabled", pluginIds);
    await this.save();
  }

  async isPluginEnabled(pluginId: string): Promise<boolean> {
    const enabledIds = await this.getEnabledPluginIds();
    return new Set(enabledIds).has(pluginId);
  }

  async setPluginEnabled(pluginId: string, enabled: boolean): Promise<void> {
    const enabledIds = new Set(await this.getEnabledPluginIds());
    if (enabled) {
      enabledIds.add(pluginId);
    } else {
      enabledIds.delete(pluginId);
    }
    await this.setEnabledPluginIds(Array.from(enabledIds));
  }
}

export default new PluginsStore();


