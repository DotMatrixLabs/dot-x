<template>
    <div class="flex flex-col justify-between items-center w-full">
        <div class="flex flex-row w-full justify-between px-2 mt-4">
            <span class="my-auto">Running version {{appVersion}}</span>
            <button @click="checkForUpdates" class="btn btn-xs">{{updaterStatus ?? "Check for updates" }}</button>
        </div>
        <div class="flex flex-row w-full justify-between px-2 mt-4">
            <span class="my-auto">Read the docs</span>
            <a href="https://docs.dotmatrixlabs.com/" target="_blank" rel="noopener noreferrer">
                <button class="btn btn-sm">Docs</button>
            </a>
        </div>
        <div class="flex flex-row w-full justify-between px-2 mt-4">
            <span class="my-auto">Give feedback</span>
            <a href="https://dotmatrixlabs.sleekplan.app/" target="_blank" rel="noopener noreferrer">
                <button class="btn btn-sm">Feedback</button>
            </a>

        </div>
        <div class="flex flex-row w-full justify-between px-2 mt-4">
            <span class="my-auto">Join our Discord</span>
            <a href="https://discord.gg/XJ7rw7sFtC" target="_blank" rel="noopener noreferrer">
                <button class="btn btn-sm">Join<i class="fab fa-discord fa-lg"></i></button>
            </a>
        </div>
        <div class="flex flex-col w-full justify-center px-2 mb-4 absolute bottom-0 left-1/2 -translate-x-1/2">
            <a href="https://dotmatrixlabs.com" target="_blank" rel="noopener noreferrer" class="mb-2 text-sm hover:underline opacity-80 text-center first-letter:">Made by DotMatrixLabs</a>
            <span class="text-center text-xs opacity-50">&copy; Frogbyte AS {{new Date().getFullYear()}}</span>
        </div>
    </div>
</template>

<script>

import tauriConf from "../../src-tauri/tauri.conf.json";
import { checkUpdate } from '@tauri-apps/api/updater';

export default {
    name: "About",
    data() {
        return {
            appVersion: tauriConf.package.version,
            updaterStatus: null,
        }
    },
    methods: {
        async checkForUpdates() {
            this.checkingForUpdates = true;
            const update = await checkUpdate();
            console.log('Update:', update);
            if(update.shouldUpdate === false) {
                this.updaterStatus = 'No updates available';
            }
            setTimeout(() => {
                this.updaterStatus = null;
            }, 2000);
        }

    },
    mounted() {

    },
}
</script>

<style lang="scss" scoped></style>