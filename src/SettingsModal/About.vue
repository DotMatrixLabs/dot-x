<template>
    <div class="flex flex-col justify-between items-center w-full">
        <div class="flex flex-row w-full justify-between px-2 mt-4">
            <span class="my-auto">Running version {{ appVersion }}</span>
            <button @click="checkForUpdates" class="btn btn-xs">{{ checkingForUpdates ? "Checking for updates..." :
                (updaterStatus ?? "Check for updates") }}</button>
        </div>
        <div class="flex flex-row w-full justify-between px-2 mt-4">
            <span class="my-auto">Read the docs</span>
            <a href="https://dml.gg/docs" target="_blank" rel="noopener noreferrer">
                <button class="btn btn-sm">Docs<i class="fa-solid fa-book fa-lg"></i></button>
            </a>
        </div>
        <div class="flex flex-row w-full justify-between px-2 mt-4">
            <span class="my-auto">Give feedback</span>
            <a href="https://dml.gg/feedback" target="_blank" rel="noopener noreferrer">
                <button class="btn btn-sm">Feedback</button>
            </a>

        </div>
        <div class="flex flex-row w-full justify-between px-2 mt-4">
            <span class="my-auto">Join our Discord</span>
            <a href="https://dml.gg/discord" target="_blank" rel="noopener noreferrer">
                <button class="btn btn-sm">Join<i class="fab fa-discord fa-lg"></i></button>
            </a>
        </div>
        <div class="flex flex-col w-full justify-center px-2 mb-4 absolute bottom-0 left-1/2 -translate-x-1/2">
            <a href="https://dml.gg" target="_blank" rel="noopener noreferrer"
                class="mb-2 text-sm hover:underline opacity-80 text-center first-letter:">Made by DotMatrixLabs</a>
            <span class="text-center text-xs opacity-50">&copy; Frogbyte AS {{ new Date().getFullYear() }}</span>
        </div>
    </div>
</template>

<script>

import tauriConf from "../../src-tauri/tauri.conf.json";
import { check } from '@tauri-apps/plugin-updater';

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