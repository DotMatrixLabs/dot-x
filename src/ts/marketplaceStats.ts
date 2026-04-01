import { Store } from "@tauri-apps/plugin-store";

const MARKETPLACE_STATE_FILE = "marketplace.json";
const DEVICE_ID_KEY = "deviceId";
const LIKED_PLUGIN_IDS_KEY = "likedPluginIds";
const LIKE_COUNT_OVERRIDES_KEY = "likeCountOverrides";
const DOWNLOAD_COUNT_OVERRIDES_KEY = "downloadCountOverrides";
const RECORDED_DOWNLOAD_VERSIONS_KEY = "recordedDownloadVersions";

const DEFAULT_MARKETPLACE_REGISTRY_URL = "https://dotmatrixlabs.github.io/dot-x-plugins/marketplace-registry.json";
const GENERIC_DB_ERROR_MESSAGE = "DB request failed";

export const MARKETPLACE_REGISTRY_URL =
  (import.meta.env.VITE_MARKETPLACE_REGISTRY_URL || "").trim() || DEFAULT_MARKETPLACE_REGISTRY_URL;

export function formatMarketplaceErrorMessage(error: unknown, fallbackMessage: string): string {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error == null
          ? ""
          : String(error);

  const message = rawMessage.trim();
  if (!message) {
    return fallbackMessage;
  }

  if (
    /failed to fetch/i.test(message) ||
    /supabase/i.test(message) ||
    /functions\/v1/i.test(message) ||
    message === GENERIC_DB_ERROR_MESSAGE
  ) {
    return fallbackMessage;
  }

  return message;
}

export type LikeCountOverrides = Record<string, number>;
export type DownloadCountOverrides = Record<string, number>;
export type RecordedDownloadVersions = Record<string, string[]>;

export function resolveMarketplaceLikeState(
  pluginId: string,
  registryLikes: number,
  likedPluginIds: Set<string>,
  likeCountOverrides: LikeCountOverrides,
): { isLiked: boolean; likes: number } {
  const isLiked = likedPluginIds.has(pluginId);
  const overrideLikes = likeCountOverrides[pluginId];

  if (typeof overrideLikes !== "number" || Number.isNaN(overrideLikes)) {
    return {
      isLiked,
      likes: registryLikes,
    };
  }

  if (isLiked) {
    return {
      isLiked,
      likes: Math.max(registryLikes, overrideLikes),
    };
  }

  return {
    isLiked,
    likes: registryLikes === overrideLikes + 1 ? overrideLikes : registryLikes,
  };
}

export function resolveMarketplaceDownloadCount(
  pluginId: string,
  registryDownloads: number,
  downloadCountOverrides: DownloadCountOverrides,
): number {
  const overrideDownloads = downloadCountOverrides[pluginId];
  if (typeof overrideDownloads !== "number" || Number.isNaN(overrideDownloads)) {
    return registryDownloads;
  }

  return Math.max(registryDownloads, overrideDownloads);
}

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

    let response: Response;
    try {
      response = await fetch(`${this.supabaseUrl}/functions/v1/${name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": this.supabaseAnonKey,
          "Authorization": `Bearer ${this.supabaseAnonKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error(GENERIC_DB_ERROR_MESSAGE);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) {
      throw new Error(formatMarketplaceErrorMessage(data?.error, GENERIC_DB_ERROR_MESSAGE));
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

  async getLikeCountOverrides(): Promise<LikeCountOverrides> {
    await this.ensureLoaded();
    const overrides = await this.store.get(LIKE_COUNT_OVERRIDES_KEY);
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(overrides).filter(
        ([pluginId, likes]) => typeof pluginId === "string" && typeof likes === "number" && !Number.isNaN(likes),
      ),
    );
  }

  async getDownloadCountOverrides(): Promise<DownloadCountOverrides> {
    await this.ensureLoaded();
    const overrides = await this.store.get(DOWNLOAD_COUNT_OVERRIDES_KEY);
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(overrides).filter(
        ([pluginId, downloads]) =>
          typeof pluginId === "string" && typeof downloads === "number" && !Number.isNaN(downloads),
      ),
    );
  }

  async getRecordedDownloadVersions(): Promise<RecordedDownloadVersions> {
    await this.ensureLoaded();
    const recordedVersions = await this.store.get(RECORDED_DOWNLOAD_VERSIONS_KEY);
    if (!recordedVersions || typeof recordedVersions !== "object" || Array.isArray(recordedVersions)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(recordedVersions).map(([pluginId, versions]) => [
        pluginId,
        Array.isArray(versions)
          ? versions.filter((version) => typeof version === "string" && version.length > 0)
          : [],
      ]),
    );
  }

  async setLocalLikeState(pluginId: string, liked: boolean, likes: number): Promise<void> {
    await this.ensureLoaded();

    const likedPluginIds = await this.getLikedPluginIds();
    if (liked) {
      likedPluginIds.add(pluginId);
    } else {
      likedPluginIds.delete(pluginId);
    }

    const likeCountOverrides = await this.getLikeCountOverrides();
    likeCountOverrides[pluginId] = Math.max(0, likes);

    await this.store.set(LIKED_PLUGIN_IDS_KEY, Array.from(likedPluginIds));
    await this.store.set(LIKE_COUNT_OVERRIDES_KEY, likeCountOverrides);
    await this.store.save();
  }

  async setLocalDownloadState(pluginId: string, downloads: number, version?: string): Promise<void> {
    await this.ensureLoaded();

    const downloadCountOverrides = await this.getDownloadCountOverrides();
    downloadCountOverrides[pluginId] = Math.max(0, downloads);
    await this.store.set(DOWNLOAD_COUNT_OVERRIDES_KEY, downloadCountOverrides);

    if (version) {
      const recordedVersions = await this.getRecordedDownloadVersions();
      const versions = new Set(recordedVersions[pluginId] || []);
      versions.add(version);
      recordedVersions[pluginId] = Array.from(versions);
      await this.store.set(RECORDED_DOWNLOAD_VERSIONS_KEY, recordedVersions);
    }

    await this.store.save();
  }

  async setLike(pluginId: string, liked: boolean): Promise<{ ok: boolean; liked: boolean }> {
    const deviceId = await this.getDeviceId();
    const response = await this.invokeFunction<{ ok: boolean; liked: boolean }>("set-plugin-like", {
      plugin_id: pluginId,
      device_id: deviceId,
      liked,
    });
    return response;
  }

  async recordDownload(
    pluginId: string,
    version: string,
    currentDownloads = 0,
  ): Promise<{ ok: boolean; counted: boolean; downloads: number }> {
    const deviceId = await this.getDeviceId();
    const recordedVersions = await this.getRecordedDownloadVersions();
    const previouslyRecordedVersions = new Set(recordedVersions[pluginId] || []);
    const canOptimisticallyCount = !previouslyRecordedVersions.has(version);
    const nextDownloads = canOptimisticallyCount ? Math.max(0, currentDownloads + 1) : Math.max(0, currentDownloads);

    if (canOptimisticallyCount) {
      await this.setLocalDownloadState(pluginId, nextDownloads, version);
    }

    try {
      const response = await this.invokeFunction<{ ok: boolean; counted: boolean }>("record-plugin-download", {
        plugin_id: pluginId,
        version,
        device_id: deviceId,
      });

      return {
        ...response,
        downloads: nextDownloads,
      };
    } catch (error) {
      if (canOptimisticallyCount) {
        const downloadCountOverrides = await this.getDownloadCountOverrides();
        downloadCountOverrides[pluginId] = Math.max(0, currentDownloads);
        await this.store.set(DOWNLOAD_COUNT_OVERRIDES_KEY, downloadCountOverrides);

        const revertedRecordedVersions = await this.getRecordedDownloadVersions();
        revertedRecordedVersions[pluginId] = (revertedRecordedVersions[pluginId] || []).filter(
          (recordedVersion) => recordedVersion !== version,
        );
        await this.store.set(RECORDED_DOWNLOAD_VERSIONS_KEY, revertedRecordedVersions);
        await this.store.save();
      }

      throw error;
    }
  }
}

export default new MarketplaceStatsStore();
