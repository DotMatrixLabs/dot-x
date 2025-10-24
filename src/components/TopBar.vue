<template>
  <nav data-tauri-drag-region class="w-screen h-12 shadow-md items-center flex z-0 fixed top-0 flex-row justify-between"
    style="-webkit-app-region: drag">
    <div class="flex flex-row ml-6 gap-4">
      <img v-if="colorScheme === 'dark'" class="object-cover h-6" src="../assets/DotX-darkmode.png">
      <img v-else class="object-cover h-6" src="../assets/DotX-lightmode.png">

      <!-- <h1 class="text-base-content">Decker</h1> -->
      <div>
        <i :class="connectionStatus ? 'text-green-400' : 'text-red-400'">●</i>
        <span class="text-sm text-base-content mx-2 capitalize">{{ connectionStatus ? 'Connected' : 'Disconnected' }}</span>
      </div>

      <a class="opacity-70 hover:opacity-100 transition-opacity" href="https://dml.gg/discord" target="_blank" rel="noopener noreferrer">
        <i class="fab fa-discord"></i>
      </a>

    </div>
    <div class="flex flex-row justify-center top-0">
      <button v-if="store.updateAvailable" title="Update available — click to install" @click="clickUpdate" class="mx-2 btn btn-ghost rounded-md p-2 w-10 h-10 cursor-default">
          <div v-show="store.downloading" class="loading loading-spinner"></div>
          <span v-if="!store.downloading"><i class="fas fa-xl fa-arrow-right-to-bracket rotate-90 text-green-500"></i></span>
      </button>
      <button title="Settings" @click="$emit('settings-toggled')" class="mx-8 btn btn-ghost rounded-md p-2">
        <i class="fas fa-gear fa-lg text-base-content"></i>
      </button>
      <button title="Minimize" @click="minimize" class="btn btn-ghost cursor-default">
        <i class="fas fa-minus fa-lg text-base-content"></i>
      </button>
      <button title="Close" @click="close" class="btn btn-ghost text-base-content hover:text-white hover:bg-red-600 cursor-default">
        <i class="fas fa-close fa-lg "></i>
      </button>
    </div>
  </nav>
</template>

<script>

import { appWindow } from '@tauri-apps/api/window'
import { useUpdateStore } from '../store/updateStore'
import { userInstallUpdate, performRelaunchIfReady } from '../ts/updater'

export default {
  name: 'TopBar',

  props: ["connection-status", "colorScheme"],

  emits: ["settings-toggled"],


  data() {
    return {
      store: useUpdateStore(),
    }
  },

  methods: {
    close() {
      appWindow.hide()
    },
    minimize() {
      appWindow.minimize()
    },
    async clickUpdate() {
      if (this.store.updateReady) {
        await performRelaunchIfReady()
      } else {
        await userInstallUpdate()
        await performRelaunchIfReady()
      }
    },
  },

  mounted() {

  },


}
</script>
