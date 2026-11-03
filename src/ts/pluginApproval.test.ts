import { describe, expect, it } from "vitest";
import { describePluginPermissions } from "./pluginApproval";

describe("describePluginPermissions", () => {
  it("labels known permissions and falls back for unknown ones", () => {
    expect(describePluginPermissions(["NET", "custom", "net"])).toEqual([
      { key: "custom", label: "custom", icon: "fa-solid fa-shield" },
      { key: "net", label: "Network access", icon: "fa-solid fa-network-wired" },
    ]);
  });

  it("returns nothing for a manifest without permissions", () => {
    expect(describePluginPermissions(undefined)).toEqual([]);
  });
});
