<template>
    <div class="flex flex-col justify-between items-center w-full">
        <div class="flex flex-row w-full justify-between px-2 mt-4">
            <span class="my-auto">Running version {{appVersion}}</span>
            <button @click="checkForUpdates" class="btn btn-xs">{{ buttonLabel }}</button>
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
            <a href="https://dml.gg" target="_blank" rel="noopener noreferrer" class="mb-2 text-sm hover:underline opacity-80 text-center first-letter:">Made by DotMatrixLabs</a>
            <span class="text-center text-xs opacity-50">&copy; Frogbyte AS {{new Date().getFullYear()}}</span>
        </div>
    </div>
</template>

<script>

import { useUpdateStore } from '../store/updateStore';
import { userCheckForUpdates } from '../ts/updater';

export default {
    name: "About",
    data() {
        return {
            store: useUpdateStore(),
            labelOverride: null,
            labelResetTimer: null,
        }
    },
    computed: {
        appVersion() { return this.store.currentVersion; },
        buttonLabel() {
            if (this.labelOverride) return this.labelOverride;
            return 'Check for updates';
        }
    },
    methods: {
        async checkForUpdates() {
            const result = await userCheckForUpdates();
            console.log(result);
            if (result === 'none') {
                this.labelOverride = 'No updates available';
                if (this.labelResetTimer) clearTimeout(this.labelResetTimer);
                this.labelResetTimer = setTimeout(() => {
                    this.labelOverride = null;
                    this.labelResetTimer = null;
                }, 3000);
            }
        }
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