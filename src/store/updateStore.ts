import { defineStore } from 'pinia';
import tauriConf from '../../src-tauri/tauri.conf.json';

export type UpdateManifest = {
  version?: string;
  body?: string;
};

type PersistedState = {
  dismissedForVersion: string[];
  notifiedVersions: string[];
  whatsNewShownForVersion: string | null;
  changelogByVersion: Record<string, string>;
};

const PERSIST_KEY = 'dotx_update_state_v1';

function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) {
      return { dismissedForVersion: [], notifiedVersions: [], whatsNewShownForVersion: null, changelogByVersion: {} };
    }
    const parsed = JSON.parse(raw);
    return {
      dismissedForVersion: parsed.dismissedForVersion ?? [],
      notifiedVersions: parsed.notifiedVersions ?? [],
      whatsNewShownForVersion: parsed.whatsNewShownForVersion ?? null,
      changelogByVersion: parsed.changelogByVersion ?? {},
    };
  } catch {
    return { dismissedForVersion: [], notifiedVersions: [], whatsNewShownForVersion: null, changelogByVersion: {} };
  }
}

function savePersisted(state: PersistedState) {
  localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
}

export const useUpdateStore = defineStore('update', {
  state: () => ({
    currentVersion: tauriConf.package.version as string,
    availableVersion: null as string | null,
    changelogHtml: '' as string,
    updateAvailable: false as boolean,
    updateReady: false as boolean,
    downloading: false as boolean,
    promptOpen: false as boolean,
    whatsNewOpen: false as boolean,
    persisted: loadPersisted() as PersistedState,
  }),

  getters: {
    hasDismissedForVersion: (state) => (version: string) => state.persisted.dismissedForVersion.includes(version),
    hasNotifiedVersion: (state) => (version: string) => state.persisted.notifiedVersions.includes(version),
    changelogForVersion: (state) => (version: string) => state.persisted.changelogByVersion[version] ?? '',
  },

  actions: {
    setAvailable(manifest: UpdateManifest) {
      const version = manifest.version ?? '';
      this.availableVersion = version;
      this.updateAvailable = !!version;
    },

    setChangelog(version: string, html: string) {
      this.changelogHtml = html;
      this.persisted.changelogByVersion[version] = html;
      savePersisted(this.persisted);
    },

    startDownloading() {
      this.downloading = true;
    },

    stopDownloading() {
      this.downloading = false;
    },

    setUpdateReady(ready: boolean) {
      this.updateReady = ready;
      if (ready) {
        this.downloading = false;
      }
    },

    openPrompt() {
      if (!this.availableVersion) return;
      if (this.hasDismissedForVersion(this.availableVersion)) return;
      this.promptOpen = true;
    },

    dismissPromptForVersion() {
      if (!this.availableVersion) return;
      if (!this.persisted.dismissedForVersion.includes(this.availableVersion)) {
        this.persisted.dismissedForVersion.push(this.availableVersion);
        savePersisted(this.persisted);
      }
      this.promptOpen = false;
    },

    markNotified(version: string) {
      if (!this.persisted.notifiedVersions.includes(version)) {
        this.persisted.notifiedVersions.push(version);
        savePersisted(this.persisted);
      }
    },

    shouldShowWhatsNewOnLaunch(): { show: boolean; html: string; version: string } {
      const v = this.currentVersion;
      if (!v) return { show: false, html: '', version: '' };
      if (this.persisted.whatsNewShownForVersion === v) return { show: false, html: '', version: v };
      const html = this.changelogForVersion(v);
      if (!html) return { show: false, html: '', version: v };
      return { show: true, html, version: v };
    },

    markWhatsNewShownFor(version: string) {
      this.persisted.whatsNewShownForVersion = version;
      savePersisted(this.persisted);
    },
  },
});


