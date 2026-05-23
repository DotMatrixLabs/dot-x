<template>
  <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div class="modal-box w-full max-w-sm relative">
      <!-- Installing / done states -->
      <template v-if="phase === 'installing'">
        <h3 class="text-xl font-bold text-center mb-4">Installing Plugin</h3>
        <div class="flex flex-col items-center gap-3">
          <span class="loading loading-spinner loading-lg"></span>
          <p class="text-sm text-base-content/70">Installing {{ manifest?.name }}…</p>
        </div>
      </template>

      <template v-else-if="phase === 'success'">
        <h3 class="text-xl font-bold text-center mb-4">Plugin Installed</h3>
        <div class="flex flex-col items-center gap-3">
          <i class="fa-solid fa-circle-check text-4xl text-success"></i>
          <p class="text-sm text-center">
            <strong>{{ manifest?.name }}</strong> v{{ manifest?.version }} was installed successfully.
          </p>
        </div>
        <div class="modal-action justify-center mt-4">
          <button class="btn btn-primary btn-sm" @click="close">Done</button>
        </div>
      </template>

      <template v-else-if="phase === 'error'">
        <h3 class="text-xl font-bold text-center mb-4">Installation Failed</h3>
        <div class="flex flex-col items-center gap-3">
          <i class="fa-solid fa-circle-xmark text-4xl text-error"></i>
          <p class="text-sm text-center text-error">{{ errorMessage }}</p>
        </div>
        <div class="modal-action justify-center mt-4">
          <button class="btn btn-ghost btn-sm" @click="close">Close</button>
        </div>
      </template>

      <!-- Confirmation state -->
      <template v-else>
        <h3 class="text-xl font-bold text-center mb-1">Install Plugin?</h3>
        <p class="text-xs text-center text-base-content/50 mb-4">{{ filePath }}</p>

        <div v-if="manifest" class="bg-base-200 rounded-lg p-3 flex flex-col gap-1 mb-4">
          <div class="flex items-center justify-between">
            <span class="font-semibold text-sm">{{ manifest.name }}</span>
            <span class="badge badge-ghost badge-sm">v{{ manifest.version }}</span>
          </div>
          <p class="text-xs text-base-content/70">{{ manifest.description }}</p>
          <p class="text-xs text-base-content/50">by {{ manifest.author }}</p>
        </div>

        <div v-else-if="loadingManifest" class="flex justify-center py-4">
          <span class="loading loading-spinner loading-md"></span>
        </div>

        <div v-else class="text-sm text-error text-center mb-4">{{ manifestError }}</div>

        <div class="modal-action justify-between mt-2">
          <button class="btn btn-ghost btn-sm" @click="close">Cancel</button>
          <button
            class="btn btn-primary btn-sm"
            :disabled="!manifest || loadingManifest"
            @click="install"
          >
            Install
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { invoke } from '@tauri-apps/api/core';

export default {
  name: 'DotxInstallModal',

  data() {
    return {
      visible: false,
      filePath: '' as string,
      manifest: null as Record<string, any> | null,
      loadingManifest: false,
      manifestError: '' as string,
      phase: 'confirm' as 'confirm' | 'installing' | 'success' | 'error',
      errorMessage: '' as string,
    };
  },

  methods: {
    async open(filePath: string) {
      this.filePath = filePath;
      this.manifest = null;
      this.manifestError = '';
      this.phase = 'confirm';
      this.errorMessage = '';
      this.visible = true;
      this.loadingManifest = true;

      try {
        this.manifest = await invoke<Record<string, any>>('get_dotx_manifest', { filePath });
      } catch (e) {
        this.manifestError = String(e);
      } finally {
        this.loadingManifest = false;
      }
    },

    close() {
      this.visible = false;
    },

    async install() {
      if (!this.manifest) return;
      this.phase = 'installing';

      try {
        await invoke('install_local_plugin', { filePath: this.filePath });
        this.phase = 'success';
      } catch (e) {
        this.errorMessage = String(e);
        this.phase = 'error';
      }
    },
  },
};
</script>
