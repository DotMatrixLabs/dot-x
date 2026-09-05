import { describe, expect, it } from "vitest";
import { excludeMappedApps, flattenMappedApps } from "./mappingUtils";

describe("flattenMappedApps", () => {
    it("includes a mapping persisted before its Pinia mirror is updated", () => {
        const authoritativeMappings = {
            "0": ["unmapped"],
            "1": ["Spotify"],
        };

        expect(flattenMappedApps(authoritativeMappings)).toEqual(["unmapped", "Spotify"]);
    });

    it("keeps an app assigned to another channel out of the unmapped channel", () => {
        expect(excludeMappedApps(["Discord", "spotify"], ["Spotify"])).toEqual(["Discord"]);
    });
});
