<template>
  <div v-if="open" class="modal modal-open h-full w-full">
    <div class="modal-box">
      <div class="flex justify-between items-start">
        <h3 class="font-bold text-lg">Update available🎉</h3>
        <button class="btn btn-ghost btn-sm" @click="dismiss">✕</button>
      </div>
      <p class="mt-2 opacity-90">
        Version {{store.availableVersion}} is now available — Update to get the latest features and improvements.
      </p>
      <div class="mt-2 text-sm">
        <a v-if="hasChangelog" class="underline text-white opacity-60 hover:opacity-80 transition-all" href="#" @click.prevent="showChangelog">See what’s new</a>
      </div>
      <div class="modal-action">
        <button class="btn" @click="dismiss" :disabled="store.downloading">Later</button>
        <button v-if="!store.updateReady" class="btn btn-primary" @click="updateNow" :disabled="store.downloading">
          <span v-if="store.downloading" class="loading loading-spinner loading-xs"></span>
          <span v-if="store.downloading" class="ml-1">Installing...</span>
          <span v-else>Update now</span>
        </button>
        <button v-else class="btn btn-primary" @click="restartNow">Restart to update</button>
      </div>
    </div>
  </div>
  </template>

<script>
import { useUpdateStore } from '../store/updateStore';
import { userInstallUpdate, performRelaunchIfReady } from '../ts/updater';

export default {
  name: 'UpdatePrompt',
  setup() {
    const store = useUpdateStore();
    return { store };
  },
  computed: {
    open() { return this.store.promptOpen && this.store.updateAvailable; },
    hasChangelog() { return !!this.store.changelogHtml; },
  },
  methods: {
    dismiss() { this.store.dismissPromptForVersion(); },
    showChangelog() { this.store.whatsNewOpen = true; },
    async updateNow() {
      await userInstallUpdate();
    },
    async restartNow() {
      await performRelaunchIfReady();
    }
  }
}
</script>

<style scoped>
</style>


