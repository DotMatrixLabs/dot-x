import { beforeEach, describe, expect, it, vi } from "vitest";

const { exists, removeFile, relaunch, setAllMappedApps } = vi.hoisted(() => ({
    exists: vi.fn(),
    removeFile: vi.fn(),
    relaunch: vi.fn(),
    setAllMappedApps: vi.fn(),
}));

vi.mock("@tauri-apps/api/fs", () => ({
    BaseDirectory: { AppData: "AppData" },
    copyFile: vi.fn(),
    createDir: vi.fn(),
    exists,
    readBinaryFile: vi.fn(),
    readDir: vi.fn().mockResolvedValue([]),
    removeFile,
}));
vi.mock("@tauri-apps/api/process", () => ({ relaunch }));
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

        expect(removeFile).toHaveBeenCalledWith("selectedApps.json", { dir: "AppData" });
        expect(setAllMappedApps).toHaveBeenCalledWith({});
    });
});
