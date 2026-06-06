<template>
    <!-- TODO: Add divider between items -->
    <div class="flex flex-col justify-between items-center w-full">
        <div class="flex flex-row w-full justify-between px-2">
            <span class="my-auto">Running version {{ appVersion }}</span>
            <button @click="checkForUpdates" class="btn btn-xs">{{ checkingForUpdates ? "Checking for updates..." :
                (updaterStatus ?? "Check for updates") }}</button>
        </div>
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
import { openLink } from "../ts/helpers.ts";

const openLinkMethod = openLink;

export default {
    name: "About",
    data() {
        return {
            appVersion: tauriConf.version,
            updaterStatus: null,
            checkingForUpdates: false,
        }
    },
    methods: {
        openLink: openLinkMethod,
        async checkForUpdates() {
            this.checkingForUpdates = true;
            const update = await check();
            if (update) {
                console.log(
                    `found update ${update.version} from ${update.date} with notes ${update.body}`
                );
                let downloaded = 0;
                let contentLength = 0;
                // alternatively we could also call update.download() and update.install() separately
                await update.downloadAndInstall((event) => {
                    switch (event.event) {
                        case 'Started':
                            contentLength = event.data.contentLength;
                            console.log(`started downloading ${event.data.contentLength} bytes`);
                            this.updaterStatus = 'Downloading update...';
                            break;
                        case 'Progress':
                            downloaded += event.data.chunkLength;
                            console.log(`downloaded ${downloaded} from ${contentLength}`);
                            this.updaterStatus = `Downloading update... ${Math.round((downloaded / contentLength) * 100)}%`;
                            break;
                        case 'Finished':
                            console.log('download finished');
                            this.updaterStatus = 'Update downloaded';
                            break;
                    }
                });
            }
            this.checkingForUpdates = false;
        }
    },
    mounted() {

    },
}
</script>

<style lang="scss" scoped></style>