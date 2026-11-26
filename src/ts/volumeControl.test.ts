import { beforeEach, describe, expect, it, vi } from "vitest";

const { getApps, getMappedApps, invoke, deckerStore } = vi.hoisted(() => ({
    getApps: vi.fn(),
    getMappedApps: vi.fn(),
    invoke: vi.fn(),
    deckerStore: { volumeSyncEnabled: false, deviceType: "Decker", setBrightness: vi.fn() },
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("./appsToControl", () => ({
    default: { getApps, getMappedApps },
}));
vi.mock("../store/deckerStore", () => ({
    useDeckerStore: () => deckerStore,
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

describe("device brightness mapping", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        invoke.mockReset();
        vi.useFakeTimers();
        getApps.mockResolvedValue(["device brightness"]);
        vi.spyOn(SystemVolumeController, "getAllSessionNames").mockResolvedValue([]);
    });

    // A Lite user may still have this mapping from a Decker; moving the slider must do nothing.
    it("sends nothing to a device without LEDs", async () => {
        deckerStore.deviceType = "Decker Lite";

        await expect(SystemVolumeController.setChannelVolume(0, 0.5)).resolves.toBeUndefined();
        expect(invoke).not.toHaveBeenCalledWith("send_decker_command", expect.anything());
    });

    it("sends LED brightness to a Decker", async () => {
        deckerStore.deviceType = "Decker";

        await SystemVolumeController.setChannelVolume(0, 0.5);
        await vi.runAllTimersAsync(); // flush the 100 ms throttle
        expect(invoke).toHaveBeenCalledWith("send_decker_command", { command: "rgb-control", options: { brightness: 127 } });
    });
});
