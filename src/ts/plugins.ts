import { Store } from "@tauri-apps/plugin-store";
import {
  createPluginApprovalRecord,
  getPluginApprovalKey,
  sanitizeStoredApprovalRecords,
  type PluginApprovalRecord,
  type PluginApprovalTarget,
} from "./pluginApproval";

class PluginsStore {
  private store!: Store;

  constructor() {}

  private async ensureLoaded() {
    if (!this.store) {
      this.store = await Store.load("plugins.json");
    }
  }

  async save() {
    await this.ensureLoaded();
    await this.store.save();
  }

  async getEnabledPluginIds(): Promise<string[]> {
    await this.ensureLoaded();
    const value = await this.store.get("enabled");
    if (Array.isArray(value)) {
      return value as string[];
    }
    return [];
  }

  async setEnabledPluginIds(pluginIds: string[]): Promise<void> {
    await this.ensureLoaded();
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

  async isPluginApproved(target: PluginApprovalTarget): Promise<boolean> {
    const approvalKey = getPluginApprovalKey(createPluginApprovalRecord(target));
    if (!approvalKey) {
      return false;
    }

    const approved = await this.getApprovedPluginRecords();
    return new Set(approved.map((entry) => getPluginApprovalKey(entry))).has(approvalKey);
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
}

export default new PluginsStore();


