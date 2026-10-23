import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { platform, version as osVersion } from '@tauri-apps/plugin-os';
import { useUpdateStore } from '../store/updateStore';
import { renderMarkdown } from './markdown';
import { createLogger } from './logger.ts';

const log = createLogger('updater');

// The update found by the last check. Installing downloads this one.
let pendingUpdate: Update | null = null;

function extractDotXHtml(body?: string): string {
  if (!body) return '';
  const startMarker = '<!-- DOT_X_CONTENT_START -->';
  const endMarker = '<!-- DOT_X_CONTENT_END -->';
  const startIndex = body.indexOf(startMarker);
  const endIndex = body.indexOf(endMarker);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return '';
  const markdown = body.slice(startIndex + startMarker.length, endIndex).replace(/<!--|-->/g, '').trim();
  return renderMarkdown(markdown);
}

let unsupportedWindowsCache: boolean | null = null;

function isUnsupportedWindows(): boolean {
  if (unsupportedWindowsCache !== null) return unsupportedWindowsCache;
  try {
    if (platform() !== 'windows') {
      unsupportedWindowsCache = false;
      return false;
    }
    const rawVersion = osVersion();
    if (!rawVersion) {
      unsupportedWindowsCache = false;
      return false;
    }
    const [majorStr, minorStr] = rawVersion.split('.');
    const major = Number.parseInt(majorStr ?? '', 10);
    const minor = Number.parseInt(minorStr ?? '', 10);
    const isWindows7 = major === 6 && minor === 1;
    const isWindows8 = major === 6 && (minor === 2 || minor === 3);
    unsupportedWindowsCache = Boolean(isWindows7 || isWindows8);
    return unsupportedWindowsCache;
  } catch {
    unsupportedWindowsCache = false;
    return false;
  }
}

// Linux builds aren't published to the update feed yet, so a check could only fail or
// offer an artifact that can't install here. Linux users install new releases by hand.
export function linuxUpdatesDisabled(): boolean {
  return platform() === 'linux';
}

async function notifyOnce(version: string) {
  const store = useUpdateStore();
  if (store.hasNotifiedVersion(version)) return;
  const granted = (await isPermissionGranted()) || (await requestPermission()) === 'granted';
  if (granted) {
    sendNotification({ title: 'Dot X Update', body: 'New version of Dot X is available!' });
  }
  store.markNotified(version);
}

export async function initUpdater() {
  await runCheck();
  setInterval(runCheck, 12 * 60 * 60 * 1000);//every 12 hours
}

export async function performRelaunchIfReady() {
  const store = useUpdateStore();
  if (store.updateReady) {
    await relaunch();
  }
}


async function runCheck(): Promise<'available' | 'none' | 'error'> {
  const store = useUpdateStore();
  if (isUnsupportedWindows() || linuxUpdatesDisabled()) {
    store.resetAvailability();
    return 'none';
  }
  try {
    const update = await check();
    if (!update) return 'none';
    pendingUpdate = update;
    const version = update.version;
    const changelog = update.body ?? '';
    store.setAvailable({ version, body: changelog });
    const html = extractDotXHtml(changelog);
    if (version && html) store.setChangelog(version, html);
    await notifyOnce(version);
    store.openPrompt();
    return 'available';
  } catch (error) {
    log.error('Failed to check for updates', error);
    return 'error';
  }
}



export async function userInstallUpdate() {
  const store = useUpdateStore();
  if (!pendingUpdate) {
    log.error('No update to install, check for updates first');
    return;
  }
  try {
    store.startDownloading();
    await pendingUpdate.downloadAndInstall();
    store.setUpdateReady(true);
  } catch (error) {
    store.stopDownloading();
    log.error('Failed to install update', error);
  }
}

// Exposed helper for user-initiated checks (e.g., About modal button)
export async function userCheckForUpdates(): Promise<'available' | 'none' | 'error'> {
  const store = useUpdateStore();
  const result = await runCheck();
  if (result === 'available') {
    store.promptOpen = true;
    return 'available';
  } else return result;
}
