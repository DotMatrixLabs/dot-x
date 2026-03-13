import { Store } from "@tauri-apps/plugin-store";

const MARKETPLACE_STATE_FILE = "marketplace.json";
const DEVICE_ID_KEY = "deviceId";
const LIKED_PLUGIN_IDS_KEY = "likedPluginIds";

export const MARKETPLACE_REGISTRY_URL = "https://dml.gg/plugin-registry";

class MarketplaceStatsStore {
  private store!: Store;
  private readonly supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  private readonly supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

  private async ensureLoaded() {
    if (!this.store) {
      this.store = await Store.load(MARKETPLACE_STATE_FILE);
    }
  }

  private ensureConfigured() {
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      throw new Error("Marketplace stats are not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
    }
  }

  private async invokeFunction<T>(name: string, payload: Record<string, unknown>): Promise<T> {
    this.ensureConfigured();

    const response = await fetch(`${this.supabaseUrl}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": this.supabaseAnonKey,
        "Authorization": `Bearer ${this.supabaseAnonKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) {
      throw new Error(data?.error || `Request to ${name} failed`);
    }

    return data as T;
  }

  async getDeviceId(): Promise<string> {
    await this.ensureLoaded();
    const existingValue = await this.store.get(DEVICE_ID_KEY);

    if (typeof existingValue === "string" && existingValue.length > 0) {
      return existingValue;
    }

    const deviceId = crypto.randomUUID();
    await this.store.set(DEVICE_ID_KEY, deviceId);
    await this.store.save();
    return deviceId;
  }

  async getLikedPluginIds(): Promise<Set<string>> {
    await this.ensureLoaded();
    const likedPluginIds = await this.store.get(LIKED_PLUGIN_IDS_KEY);
    if (!Array.isArray(likedPluginIds)) {
      return new Set();
    }

    return new Set(likedPluginIds.filter((pluginId) => typeof pluginId === "string" && pluginId.length > 0));
  }

  private async saveLikedPluginIds(pluginIds: Set<string>) {
    await this.ensureLoaded();
    await this.store.set(LIKED_PLUGIN_IDS_KEY, Array.from(pluginIds));
    await this.store.save();
  }

  async setLike(pluginId: string, liked: boolean): Promise<{ ok: boolean; liked: boolean }> {
    const deviceId = await this.getDeviceId();
    const response = await this.invokeFunction<{ ok: boolean; liked: boolean }>("set-plugin-like", {
      plugin_id: pluginId,
      device_id: deviceId,
      liked,
    });

    const likedPluginIds = await this.getLikedPluginIds();
    if (response.liked) {
      likedPluginIds.add(pluginId);
    } else {
      likedPluginIds.delete(pluginId);
    }

    await this.saveLikedPluginIds(likedPluginIds);
    return response;
  }

  async recordDownload(pluginId: string, version: string): Promise<{ ok: boolean; counted: boolean }> {
    const deviceId = await this.getDeviceId();
    return this.invokeFunction<{ ok: boolean; counted: boolean }>("record-plugin-download", {
      plugin_id: pluginId,
      version,
      device_id: deviceId,
    });
  }
}

export default new MarketplaceStatsStore();
