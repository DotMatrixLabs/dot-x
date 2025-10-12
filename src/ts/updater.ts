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
      manifest!.body = `<!-- DOT_X_CONTENT_START -->
      <!--
# New Features
- It's now possible to invert sliders to support alternative hardware and wiring.  
Toggle inverted sliders under **"General"** in the settings menu.
[more](https://dotmatrixlabs.com/changelog/1.2.3-1/)

-->
<!-- DOT_X_CONTENT_END -->

---

<!-- WEB_CONTENT_START -->
## New Features

### Inverted Sliders
You can now **invert sliders** to support alternative hardware configurations or reversed wiring.

#### Details
- **Key Capability**: Invert any slider directly from the **"General"** section in the settings menu.  
- **Purpose**: Makes it easier to adapt to different slider orientations or wiring setups.  
- **Use Case**: Perfect for custom hardware builds or retrofitted setups that need reversed control behavior.

This feature was designed to give users more flexibility when integrating Decker with non-standard or DIY hardware.
<!-- WEB_CONTENT_END -->
`
      store.setAvailable({ version, body: manifest?.body });
      const html = extractDotXHtml(manifest?.body);
      if (version && html) store.setChangelog(version, html);
      await notifyOnce(version);
      store.openPrompt();
    } catch {
      // ignore
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
  } catch {
    store.stopDownloading();
  }
}


