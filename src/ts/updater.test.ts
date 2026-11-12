import { beforeEach, describe, expect, it, vi } from "vitest";

const config: Record<string, unknown> = {};
let appVersion = "2.0.0";

vi.mock("./config.ts", () => ({
  default: {
    get: vi.fn(async (key: string) => config[key]),
    set: vi.fn(async (key: string, value: unknown) => { config[key] = value; }),
  },
}));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn(async () => appVersion) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn() }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));
vi.mock("@tauri-apps/plugin-notification", () => ({}));
vi.mock("@tauri-apps/plugin-os", () => ({ platform: vi.fn(), version: vi.fn() }));
vi.mock("../store/updateStore", () => ({ useUpdateStore: () => ({ resetAvailability: vi.fn() }) }));

import { getUpdateTrack } from "./updater";

describe("getUpdateTrack", () => {
  beforeEach(() => {
    for (const key of Object.keys(config)) delete config[key];
    appVersion = "2.0.0";
  });

  it("puts a fresh beta install on Beta and keeps it there after the stable release", async () => {
    appVersion = "2.0.0-beta.3";
    expect(await getUpdateTrack()).toBe("beta");
    appVersion = "2.0.0";
    expect(await getUpdateTrack()).toBe("beta");
  });

  it("starts a fresh stable install on Stable without saving a choice", async () => {
    expect(await getUpdateTrack()).toBe("stable");
    expect(config.updateTrack).toBeUndefined();
  });

  it("respects a tester who switched a beta build to Stable", async () => {
    appVersion = "2.0.0-beta.3";
    config.updateTrack = "stable";
    expect(await getUpdateTrack()).toBe("stable");
  });
});
