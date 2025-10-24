import { checkUpdate, installUpdate, onUpdaterEvent } from '@tauri-apps/api/updater';
import { relaunch } from '@tauri-apps/api/process';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/api/notification';
import { useUpdateStore } from '../store/updateStore';
import { marked } from 'marked';

function extractDotXHtml(body?: string): string {
  if (!body) return '';
  const startMarker = '<!-- DOT_X_CONTENT_START -->';
  const endMarker = '<!-- DOT_X_CONTENT_END -->';
  const startIndex = body.indexOf(startMarker);
  const endIndex = body.indexOf(endMarker);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return '';
  const markdown = body.slice(startIndex + startMarker.length, endIndex).replace(/<!--|-->/g, '').trim();
  const rendered = marked.parse(markdown);
  return typeof rendered === 'string' ? rendered : '';
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
  const store = useUpdateStore();

  onUpdaterEvent(({ error, status }) => {
    if (error) {
      // swallow errors; we keep UX simple
      store.stopDownloading();
      return;
    }
    switch (status) {
      case 'PENDING':
        store.startDownloading();
        break;
      case 'DONE':
        store.setUpdateReady(true);
        break;
      case 'UPTODATE':
        store.stopDownloading();
        break;
      case 'ERROR':
        store.stopDownloading();
        break;
      default:
        break;
    }
  });

  const runCheck = async () => {
    try {
      const { shouldUpdate, manifest } = await checkUpdate();
      if (!shouldUpdate) return;
      const version = manifest?.version ?? '';
      const changelog = manifest?.body ?? '';
      store.setAvailable({ version, body: changelog });
      const html = extractDotXHtml(changelog);
      if (version && html) store.setChangelog(version, html);
      await notifyOnce(version);
      store.openPrompt();
    } catch {
      console.error('Error checking for updates');
    }
  };

  await runCheck();
  setInterval(runCheck, 12 * 60 * 60 * 1000);//every 12 hours
}

export async function performRelaunchIfReady() {
  const store = useUpdateStore();
  if (store.updateReady) {
    await relaunch();
  }
}

export async function userInstallUpdate() {
  const store = useUpdateStore();
  try {
    store.startDownloading();
    await installUpdate();
  } catch (error) {
    store.stopDownloading();
    console.error(error);
  }
}


