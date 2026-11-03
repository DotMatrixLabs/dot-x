import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// plugins.json as the backend sees it on disk, and the frontend's cached copy.
const disk: { enabled: string[] } = { enabled: [] };
let cache: { enabled: string[] } = { enabled: [] };

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (command: string, args?: { pluginId?: string }) => {
    if (command === "uninstall_marketplace_plugin") {
      // Like the Rust command: edits plugins.json on disk, not the frontend cache.
      disk.enabled = disk.enabled.filter((id) => id !== args?.pluginId);
    }
  }),
}));

vi.mock("../ts/pluginStorage", () => ({
  default: {
    reloadFromDisk: vi.fn(async () => {
      cache = { enabled: [...disk.enabled] };
    }),
    loadPersistedPluginState: vi.fn(async () => ({
      enabledPluginIds: [...cache.enabled],
      approvedRecords: [],
      pluginUpdates: {},
      lastPluginUpdateCheckAt: null,
    })),
    setEnabledPluginIds: vi.fn(async (ids: string[]) => {
      cache.enabled = [...ids];
      disk.enabled = [...ids]; // store.save() writes the whole cache back
    }),
  },
}));

vi.mock("vue-sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

import { usePluginStore } from "./pluginStore";
import PluginStorage from "../ts/pluginStorage";

describe("uninstallPluginId", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    disk.enabled = ["kept", "removed"];
    cache = { enabled: [...disk.enabled] };
  });

  it("drops the plugin from the enabled list so a later save cannot bring it back", async () => {
    const store = usePluginStore();
    await store.loadPersistedPluginState();
    expect(store.enabledPlugins.has("removed")).toBe(true);

    await store.uninstallPluginId("removed");

    expect(store.enabledPlugins.has("removed")).toBe(false);
    expect(store.enabledPlugins.has("kept")).toBe(true);

    // Any later persistence (enabling another plugin, rollback, ...) writes the cache back.
    await PluginStorage.setEnabledPluginIds(Array.from(store.enabledPlugins));
    expect(disk.enabled).toEqual(["kept"]);
  });
});
