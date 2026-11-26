import { describe, expect, it } from "vitest";
import { deviceTypeFor, hasLeds } from "./deviceModels";

describe("deviceTypeFor", () => {
    it("recognizes Decker and Decker Lite by USB VID/PID", () => {
        expect(deviceTypeFor({ vid: 1240, pid: 58918 })).toBe("Decker");
        expect(deviceTypeFor({ vid: 1240, pid: 58549 })).toBe("Decker Lite");
    });

    it("treats anything else as unknown", () => {
        expect(deviceTypeFor({ vid: 1240, pid: 1 })).toBe("Unknown");
        expect(deviceTypeFor(undefined)).toBe("Unknown");
    });
});

describe("hasLeds", () => {
    it("is false only for Decker Lite", () => {
        expect(hasLeds("Decker")).toBe(true);
        expect(hasLeds("Unknown")).toBe(true);
        expect(hasLeds("Decker Lite")).toBe(false);
    });
});
