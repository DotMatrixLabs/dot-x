import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendCommand, deckerStore } = vi.hoisted(() => ({
    sendCommand: vi.fn(),
    deckerStore: { deviceType: "Decker" },
}));

vi.mock("./decker", () => ({ default: { sendCommand } }));
vi.mock("../store/deckerStore", () => ({ useDeckerStore: () => deckerStore }));

import RGBController, { NO_LEDS_ERROR } from "./RGBController";

describe("RGBController.setEffect", () => {
    beforeEach(() => {
        sendCommand.mockReset();
        vi.useFakeTimers();
    });

    it("refuses a device without LEDs and sends nothing", () => {
        deckerStore.deviceType = "Decker Lite";

        expect(() => RGBController.setEffect("static", 0, 255, "#ffffff")).toThrow(NO_LEDS_ERROR);
        expect(sendCommand).not.toHaveBeenCalled();
    });

    it("sends the effect to a Decker", () => {
        deckerStore.deviceType = "Decker";

        RGBController.setEffect("static", 0, 255, "#ffffff");
        vi.runAllTimers(); // flush the 100 ms throttle
        expect(sendCommand).toHaveBeenCalledOnce();
        expect(sendCommand.mock.calls[0][0]).toBe("rgb-control");
    });
});
