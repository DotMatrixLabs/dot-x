<template>
    <!-- TODO: Add divider between items -->
    <div class="flex flex-col justify-between items-center w-full">
        <div class="flex flex-row w-full justify-between px-2">
            <span class="my-auto">Running version {{ appVersion }}</span>
            <span v-if="updatesDisabled" class="my-auto text-xs opacity-70">Install new versions manually on Linux</span>
            <button v-else @click="checkForUpdates" :disabled="updateBusy" class="btn btn-xs">{{ buttonLabel }}</button>
        </div>
        <template v-if="!updatesDisabled">
            <div data-setting="Update track" class="flex flex-row w-full justify-between px-2 mt-4">
                <label class="my-auto" for="update-track">Update track</label>
                <select id="update-track" class="select select-bordered select-sm" :value="updateTrack"
                    :disabled="updateBusy" @change="changeUpdateTrack">
                    <option value="stable">Stable</option>
                    <option value="beta">Beta/Nightly</option>
                </select>
            </div>
            <p class="w-full px-2 mt-3 text-xs opacity-60">Beta/Nightly includes stable releases and may contain unfinished changes.</p>
        </template>
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

import { openLink } from "../ts/helpers.ts";
import { useUpdateStore } from '../store/updateStore';
import { getUpdateTrack, setUpdateTrack, userCheckForUpdates, linuxUpdatesDisabled } from '../ts/updater';
import { createLogger } from '../ts/logger.ts';

const log = createLogger('updater');

const openLinkMethod = openLink;

export default {
    name: "About",
    data() {
        return {
            store: useUpdateStore(),
            checkingForUpdates: false,
            updatesDisabled: linuxUpdatesDisabled(),
            loadingTrack: true,
            updateTrack: 'stable',
            labelOverride: null,
            labelResetTimer: null,
        }
    },
    computed: {
        appVersion() { return this.store.currentVersion; },
        updateBusy() { return this.checkingForUpdates || this.loadingTrack || this.store.downloading; },
        buttonLabel() {
            if (this.checkingForUpdates) return 'Checking for updates...';
            if (this.labelOverride) return this.labelOverride;
            return 'Check for updates';
        }
    },
    methods: {
        openLink: openLinkMethod,
        async loadUpdateTrack() {
            try {
                this.updateTrack = await getUpdateTrack();
            } catch (error) {
                log.error('Failed to load update track', error);
            } finally {
                this.loadingTrack = false;
            }
        },
        async changeUpdateTrack(event) {
            const track = event.target.value;
            if (track !== 'stable' && track !== 'beta') return;
            try {
                await setUpdateTrack(track);
                this.updateTrack = track;
            } catch (error) {
                event.target.value = this.updateTrack;
                log.error('Failed to save update track', error);
            }
        },
        async checkForUpdates() {
            this.checkingForUpdates = true;
            const result = await userCheckForUpdates();
            this.checkingForUpdates = false;
            if (result === 'none' || result === 'error') {
                this.labelOverride = result === 'none' ? 'No updates available' : 'Update check failed';
                if (this.labelResetTimer) clearTimeout(this.labelResetTimer);
                this.labelResetTimer = setTimeout(() => {
                    this.labelOverride = null;
                    this.labelResetTimer = null;
                }, 3000);
            }
        }
    },
    mounted() {
        this.loadUpdateTrack();
    },
    beforeUnmount() {
        if (this.labelResetTimer) {
            clearTimeout(this.labelResetTimer);
            this.labelResetTimer = null;
        }
    },
}
</script>

<style lang="scss" scoped></style>
