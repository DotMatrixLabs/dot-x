import { beforeEach, describe, expect, it, vi } from "vitest";

const { getApps, getMappedApps } = vi.hoisted(() => ({
    getApps: vi.fn(),
    getMappedApps: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("./appsToControl", () => ({
    default: { getApps, getMappedApps },
}));
vi.mock("../store/deckerStore", () => ({
    useDeckerStore: () => ({ volumeSyncEnabled: false }),
}));

import SystemVolumeController from "./volumeControl";

describe("setChannelVolume", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        getApps.mockResolvedValue(["unmapped"]);
        getMappedApps.mockRejectedValue(new Error("selectedApps.json is unreadable"));
    });

    it("skips the unmapped channel when authoritative mappings cannot be read", async () => {
        const setVolume = vi.spyOn(SystemVolumeController, "setVolume");
        vi.spyOn(SystemVolumeController, "getAllSessionNames").mockResolvedValue(["Spotify"]);

        await expect(SystemVolumeController.setChannelVolume(0, 0.5)).resolves.toBeUndefined();
        expect(setVolume).not.toHaveBeenCalled();
    });
});
