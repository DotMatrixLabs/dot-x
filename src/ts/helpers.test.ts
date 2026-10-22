import { beforeEach, describe, expect, it, vi } from "vitest";

const { exists, remove, relaunch, setAllMappedApps } = vi.hoisted(() => ({
    exists: vi.fn(),
    remove: vi.fn(),
    relaunch: vi.fn(),
    setAllMappedApps: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
    BaseDirectory: { AppData: "AppData" },
    copyFile: vi.fn(),
    exists,
    mkdir: vi.fn(),
    readDir: vi.fn().mockResolvedValue([]),
    readFile: vi.fn(),
    remove,
}));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch }));
vi.mock("@tauri-apps/plugin-shell", () => ({ open: vi.fn() }));
vi.mock("../store/deckerStore", () => ({
    useDeckerStore: () => ({ setAllMappedApps }),
}));

import { resetChannelSettings } from "./helpers";

describe("resetChannelSettings", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        exists.mockResolvedValue(true);
    });

    it("clears the live mapped-app mirror after deleting persisted selections", async () => {
        await resetChannelSettings();

        expect(remove).toHaveBeenCalledWith("selectedApps.json", { baseDir: "AppData" });
        expect(setAllMappedApps).toHaveBeenCalledWith({});
    });
});
