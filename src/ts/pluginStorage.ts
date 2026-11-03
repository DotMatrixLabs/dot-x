import { Store } from "@tauri-apps/plugin-store";
import {
  createPluginApprovalRecord,
  getPluginApprovalKey,
  sanitizeStoredApprovalRecords,
  type PluginApprovalRecord,
  type PluginApprovalTarget,
} from "./pluginApproval";

export interface PluginUpdateRecord {
  pluginId: string;
  installedVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
}

export interface PersistedPluginState {
  enabledPluginIds: string[];
  approvedRecords: PluginApprovalRecord[];
  pluginUpdates: Record<string, PluginUpdateRecord>;
  lastPluginUpdateCheckAt: string | null;
}

class PluginStorage {
  private store!: Store;

  private async ensureLoaded() {
    if (!this.store) {
      this.store = await Store.load("plugins.json");
    }
  }

  async save() {
    await this.ensureLoaded();
    await this.store.save();
  }

  /** Re-read plugins.json after the backend changed it on disk. */
  async reloadFromDisk() {
    await this.ensureLoaded();
    await this.store.reload();
  }

  async getEnabledPluginIds(): Promise<string[]> {
    await this.ensureLoaded();
    const value = await this.store.get("enabled");
    if (Array.isArray(value)) {
      return value.filter((entry): entry is string => typeof entry === "string");
    }
    return [];
  }

  async setEnabledPluginIds(pluginIds: string[]): Promise<void> {
    await this.ensureLoaded();
    await this.store.set("enabled", pluginIds);
    await this.save();
  }

  async getApprovedPluginRecords(): Promise<PluginApprovalRecord[]> {
    await this.ensureLoaded();
    const value = await this.store.get("approved");
    const { records, changed } = sanitizeStoredApprovalRecords(value);
    if (changed) {
      await this.store.set("approved", records);
      await this.save();
    }
    return records;
  }

  async approvePlugin(target: PluginApprovalTarget): Promise<PluginApprovalRecord | null> {
    const approvalRecord = createPluginApprovalRecord(target);
    if (!approvalRecord) {
      return null;
    }

    const approved = await this.getApprovedPluginRecords();
    const approvedByKey = new Map<string, PluginApprovalRecord>();
    for (const entry of approved) {
      const key = getPluginApprovalKey(entry);
      if (key) {
        approvedByKey.set(key, entry);
      }
    }

    const approvalKey = getPluginApprovalKey(approvalRecord);
    if (!approvalKey) {
      return null;
    }

    approvedByKey.set(approvalKey, {
      ...approvalRecord,
      approvedAt: new Date().toISOString(),
    });

    await this.ensureLoaded();
    await this.store.set("approved", Array.from(approvedByKey.values()));
    await this.save();
    return approvedByKey.get(approvalKey) ?? null;
  }

  private normalizeUpdateRecord(value: unknown): PluginUpdateRecord | null {
    if (!value || typeof value !== "object") {
      return null;
    }

    const candidate = value as Record<string, unknown>;
    const pluginId = typeof candidate.pluginId === "string" ? candidate.pluginId.trim() : "";
    const installedVersion = typeof candidate.installedVersion === "string" ? candidate.installedVersion.trim() : "";
    const latestVersion = typeof candidate.latestVersion === "string" ? candidate.latestVersion.trim() : "";
    const hasUpdate = typeof candidate.hasUpdate === "boolean" ? candidate.hasUpdate : true;

    if (!pluginId || !installedVersion || !latestVersion) {
      return null;
    }

    return {
      pluginId,
      installedVersion,
      latestVersion,
      hasUpdate,
    };
  }

  async getPluginUpdateRecords(): Promise<Record<string, PluginUpdateRecord>> {
    await this.ensureLoaded();
    const value = await this.store.get("updates");
    const normalized: Record<string, PluginUpdateRecord> = {};

    if (Array.isArray(value)) {
      for (const entry of value) {
        const record = this.normalizeUpdateRecord(entry);
        if (record) {
          normalized[record.pluginId] = record;
        }
      }
      return normalized;
    }

    if (value && typeof value === "object") {
      for (const [pluginId, entry] of Object.entries(value as Record<string, unknown>)) {
        const record = this.normalizeUpdateRecord({
          pluginId,
          ...(entry && typeof entry === "object" ? entry : {}),
        });
        if (record) {
          normalized[record.pluginId] = record;
        }
      }
    }

    return normalized;
  }

  async setPluginUpdateRecords(
    pluginUpdates: Record<string, PluginUpdateRecord>,
    lastCheckedAt: string | null,
  ): Promise<void> {
    await this.ensureLoaded();
    await this.store.set("updates", pluginUpdates);
    await this.store.set("updatesLastCheckedAt", lastCheckedAt);
    await this.save();
  }

  async getLastPluginUpdateCheckAt(): Promise<string | null> {
    await this.ensureLoaded();
    const value = await this.store.get("updatesLastCheckedAt");
    return typeof value === "string" && value.trim().length > 0 ? value : null;
  }

  async loadPersistedPluginState(): Promise<PersistedPluginState> {
    const [enabledPluginIds, approvedRecords, pluginUpdates, lastPluginUpdateCheckAt] = await Promise.all([
      this.getEnabledPluginIds(),
      this.getApprovedPluginRecords(),
      this.getPluginUpdateRecords(),
      this.getLastPluginUpdateCheckAt(),
    ]);

    return {
      enabledPluginIds,
      approvedRecords,
      pluginUpdates,
      lastPluginUpdateCheckAt,
    };
  }
}

export default new PluginStorage();
