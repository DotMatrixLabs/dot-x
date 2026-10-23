import { platform, version as osVersion } from "@tauri-apps/plugin-os";
import tauriConf from "../../src-tauri/tauri.conf.json";

export type FeedbackType = "bug" | "feature";

export const FEEDBACK_MAX_LENGTH = 2000;
const METADATA_MAX_LENGTH = 64;
const REQUEST_TIMEOUT_MS = 15_000;

const apiUrl = (import.meta.env.VITE_VEERIFY_API_URL || "").trim().replace(/\/+$/, "");
const appKey = (import.meta.env.VITE_VEERIFY_APP_KEY || "").trim();

function readOs(): { os?: string; osVersion?: string } {
  try {
    return {
      os: platform().slice(0, METADATA_MAX_LENGTH),
      osVersion: osVersion().slice(0, METADATA_MAX_LENGTH),
    };
  } catch {
    return {};
  }
}

function serverMessage(body: unknown): string | null {
  const data = (body as { data?: { error?: { message?: unknown } } } | null)?.data;
  const message = data?.error?.message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

// Posts feedback to the public DotMatrixLabs board. Throws an Error with a
// user-facing message on any failure so the caller can show it and offer a retry.
export async function sendFeedback(type: FeedbackType, description: string): Promise<void> {
  if (!apiUrl || !appKey) {
    throw new Error("Feedback isn't set up in this build of Dot X.");
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/v1/feedback`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${appKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type,
        description: description.trim(),
        appVersion: tauriConf.version,
        ...readOs(),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new Error("Couldn't reach the feedback server. Check your connection and try again.");
  }

  if (response.ok) return;

  const body = await response.json().catch(() => null);
  if (response.status === 429) {
    throw new Error("You've sent a lot of feedback in a short time. Wait a minute and try again.");
  }
  if (response.status === 400) {
    throw new Error(serverMessage(body) ?? "The feedback server rejected this message.");
  }
  if (response.status === 401) {
    throw new Error("Feedback isn't available right now. Please try again later.");
  }
  throw new Error(`The feedback server returned an error (${response.status}). Please try again.`);
}
