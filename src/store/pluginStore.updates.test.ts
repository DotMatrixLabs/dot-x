import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// Installed versions as the backend sees them. The update check snapshots them
// when it starts, then waits on the network before answering.
const installed: Record<string, string> = {};
const latest: Record<string, string> = { a: "2.0.0", b: "2.0.0" };
let releaseCheck: (() => void)[] = [];

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (command: string) => {
    if (command !== "check_marketplace_plugin_updates") return;
    const snapshot = { ...installed };
    await new Promise<void>((resolve) => releaseCheck.push(resolve));
    return Object.entries(snapshot)
      .filter(([id, version]) => version !== latest[id])
      .map(([pluginId, installedVersion]) => ({
        pluginId,
        installedVersion,
        latestVersion: latest[pluginId],
        hasUpdate: true,
      }));
  }),
}));

vi.mock("../ts/pluginStorage", () => ({
  default: { setPluginUpdateRecords: vi.fn(async () => {}) },
}));

vi.mock("vue-sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

import { usePluginStore } from "./pluginStore";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const releaseAll = async () => {
  while (releaseCheck.length > 0) {
    const pending = releaseCheck;
    releaseCheck = [];
    pending.forEach((release) => release());
    await flush();
  }
};

describe("refreshPluginUpdates", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    installed.a = "1.0.0";
    installed.b = "1.0.0";
    releaseCheck = [];
  });

  it("re-checks when asked during a check that started before a plugin was updated", async () => {
    const store = usePluginStore();

    // Plugin a finishes updating and starts a check; b is still on 1.0.0.
    installed.a = "2.0.0";
    const first = store.refreshPluginUpdates();
    await flush();

    // Plugin b finishes updating while that check is still in flight.
    installed.b = "2.0.0";
    const second = store.refreshPluginUpdates();

    await releaseAll();
    await Promise.all([first, second]);

    expect(store.pluginUpdates).toEqual({});
  });

  it("runs one follow-up check for many requests made during a check", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const store = usePluginStore();
    vi.mocked(invoke).mockClear();

    const calls = [store.refreshPluginUpdates()];
    await flush();
    calls.push(store.refreshPluginUpdates(), store.refreshPluginUpdates(), store.refreshPluginUpdates());

    await releaseAll();
    await Promise.all(calls);

    expect(vi.mocked(invoke)).toHaveBeenCalledTimes(2);
  });
});
