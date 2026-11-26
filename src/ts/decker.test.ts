import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, store } = vi.hoisted(() => ({
    invoke: vi.fn(),
    store: { deviceType: "Unknown", setDeviceType: vi.fn(), setConnected: vi.fn() },
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => undefined) }));
vi.mock("../store/deckerStore.ts", () => ({ useDeckerStore: () => store }));
vi.mock("./config.ts", () => ({ default: { get: vi.fn().mockResolvedValue(false) } }));
vi.mock("./telemetry", () => ({ trackTelemetryEvent: vi.fn() }));
vi.mock("./volumeControl.ts", () => ({ default: {} }));
vi.mock("./appsToControl.ts", () => ({ default: {} }));
vi.mock("../js/eventBus.js", () => ({ default: { emit: vi.fn() } }));

import Decker from "./decker";

describe("Decker.init", () => {
    beforeEach(() => {
        invoke.mockReset();
        store.setDeviceType.mockReset();
    });

    // Settings may never open in a tray-only session, so connecting must set the type.
    it("sets the device type from the connected port's USB ID", async () => {
        invoke.mockImplementation(async (cmd: string) =>
            cmd === "get_devices" ? [{ port_name: "COM7", vid: 1240, pid: 58549 }] : undefined,
        );

        await Decker.init("COM7");

        expect(store.setDeviceType).toHaveBeenCalledWith("Decker Lite");
    });
});
