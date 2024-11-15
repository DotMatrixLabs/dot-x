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

import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
const appWindow = getCurrentWebviewWindow()

export default {
  name: 'TopBar',

  props: ["connection-status", "colorScheme"],

  emits: ["settings-toggled"],

  data() {
    return {
    }
  },

  methods: {
    close() {
      appWindow.hide()
    },
    minimize() {
      appWindow.minimize()
    },
  },

  mounted() {

  },


}
</script>
