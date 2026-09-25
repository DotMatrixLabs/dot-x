<template>
    <!-- TODO: Add divider between items -->
    <div class="flex flex-col justify-between items-center w-full">
        <div class="flex flex-row w-full justify-between px-2">
            <span class="my-auto">Running version {{ appVersion }}</span>
            <button @click="checkForUpdates" :disabled="checkingForUpdates || loadingTrack" class="btn btn-xs">{{ checkingForUpdates ? "Checking for updates..." :
                (updaterStatus ?? "Check for updates") }}</button>
        </div>
        <div data-setting="Update track" class="flex flex-row w-full justify-between px-2 mt-4">
            <label class="my-auto" for="update-track">Update track</label>
            <select id="update-track" class="select select-bordered select-sm" :value="updateTrack"
                :disabled="checkingForUpdates || loadingTrack" @change="setUpdateTrack">
                <option value="stable">Stable</option>
                <option value="beta">Beta/Nightly</option>
            </select>
        </div>
        <p class="w-full px-2 text-xs opacity-60">Beta/Nightly includes stable releases and may contain unfinished changes.</p>
        <div class="flex flex-row w-full justify-between px-2 mt-4">
            <span class="my-auto">Read the docs</span>
            <button @click="openLink('https://dml.gg/docs')" class="btn btn-sm">Docs<i class="fa-solid fa-book fa-lg"></i></button>
        </div>
        <div class="flex flex-row w-full justify-between px-2 mt-4">
            <span class="my-auto">Give feedback</span>
            <button @click="openLink('https://dml.gg/feedback')" class="btn btn-sm">Feedback</button>
        </div>
        <div class="flex flex-row w-full justify-between px-2 mt-4">
            <span class="my-auto">Join our Discord</span>
            <button @click="openLink('https://dml.gg/discord')" class="btn btn-sm">Join<i class="fab fa-discord fa-lg"></i></button>
        </div>
        <div class="flex flex-col w-full justify-center px-2 mb-4 absolute bottom-0 left-1/2 -translate-x-1/2">
            <span @click="openLink('https://dml.gg')"
                class="mb-2 text-sm hover:underline opacity-80 text-center first-letter: cursor-pointer">Made by DotMatrixLabs</span>
            <span class="text-center text-xs opacity-50">&copy; Frogbyte AS {{ new Date().getFullYear() }}</span>
        </div>
    </div>
</template>

<script>

import tauriConf from "../../src-tauri/tauri.conf.json";
import { check } from '@tauri-apps/plugin-updater';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { openLink } from "../ts/helpers.ts";
import { createLogger } from "../ts/logger.ts";
import ConfigStore from "../ts/config.ts";

const log = createLogger("updater");

const openLinkMethod = openLink;

export default {
    name: "About",
    data() {
        return {
            appVersion: tauriConf.version,
            updaterStatus: null,
            checkingForUpdates: false,
            loadingTrack: true,
            updateTrack: 'stable',
        }
    },
    methods: {
        openLink: openLinkMethod,
        async loadUpdateTrack() {
            try {
                this.updateTrack = await ConfigStore.get('updateTrack') === 'beta' ? 'beta' : 'stable';
            } catch (error) {
                log.error('Failed to load update track', error);
            } finally {
                this.loadingTrack = false;
            }
        },
        async setUpdateTrack(event) {
            const track = event.target.value;
            if (track !== 'stable' && track !== 'beta') return;
            try {
                await ConfigStore.set('updateTrack', track);
                this.updateTrack = track;
                this.updaterStatus = null;
            } catch (error) {
                event.target.value = this.updateTrack;
                log.error('Failed to save update track', error);
            }
        },
        async checkForUpdates() {
            this.checkingForUpdates = true;
            this.updaterStatus = null;
            try {
                if (this.updateTrack === 'beta') {
                    await this.installBetaUpdate();
                } else {
                    await this.installStableUpdate();
                }
            } catch (error) {
                this.updaterStatus = 'Update check failed';
                log.error('Failed to check for updates', error);
            } finally {
                this.checkingForUpdates = false;
            }
        },
        async installBetaUpdate() {
            const unlistenProgress = await listen('app-update-progress', ({ payload }) => {
                this.setDownloadProgress(payload.downloaded, payload.total);
            });
            try {
                const unlistenFinished = await listen('app-update-downloaded', () => {
                    this.updaterStatus = 'Update downloaded';
                });
                try {
                    const version = await invoke('install_beta_update');
                    if (!version) this.updaterStatus = 'No updates available';
                } finally {
                    unlistenFinished();
                }
            } finally {
                unlistenProgress();
            }
        },
        async installStableUpdate() {
            const update = await check();
            if (!update) {
                this.updaterStatus = 'No updates available';
                return;
            }
            log.info(`found update ${update.version} from ${update.date} with notes ${update.body}`);
            let downloaded = 0;
            let contentLength = 0;
            try {
                await update.downloadAndInstall((event) => {
                    switch (event.event) {
                        case 'Started':
                            contentLength = event.data.contentLength;
                            this.updaterStatus = 'Downloading update...';
                            break;
                        case 'Progress':
                            downloaded += event.data.chunkLength;
                            this.setDownloadProgress(downloaded, contentLength);
                            break;
                        case 'Finished':
                            this.updaterStatus = 'Update downloaded';
                            break;
                    }
                });
            } finally {
                await update.close();
            }
        },
        setDownloadProgress(downloaded, total) {
            this.updaterStatus = total
                ? `Downloading update... ${Math.round((downloaded / total) * 100)}%`
                : 'Downloading update...';
        }
    },
    mounted() {
        this.loadUpdateTrack();
    },
}
</script>

<style lang="scss" scoped></style>
