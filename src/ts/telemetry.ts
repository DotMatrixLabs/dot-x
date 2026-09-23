import { invoke } from "@tauri-apps/api/core";
import { createLogger } from "./logger";

const log = createLogger("telemetry");

export type TelemetryPreference = "crashReportingEnabled" | "analyticsEnabled";

export function trackTelemetryEvent(
  event: string,
  properties?: Record<string, string>,
): void {
  void invoke("track_telemetry_event", { event, properties }).catch((error) => {
    log.warn("Failed to send usage event", error);
  });
}

export function setTelemetryPreference(
  preference: TelemetryPreference,
  enabled: boolean,
): Promise<void> {
  return invoke("set_telemetry_preference", { preference, enabled });
}
