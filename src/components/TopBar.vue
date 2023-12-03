<template>
  <nav data-tauri-drag-region class="w-screen h-12 shadow-md items-center flex z-0 fixed top-0 flex-row justify-between"
    style="-webkit-app-region: drag">
    <!-- <img class="h-12 absolute -top-1 left-1/2 -translate-x-1/2 transform" src="../../assets/logos/decker-logo.svg"/> -->
    <div class="flex flex-row ml-6 gap-4">
      <!-- <button v-show="!connectionStatus" title="Retry connection" @click="$emit('connect-to-board')" class="mx-8 btn btn-ghost my-2 rounded-md p-2">
        <i class="fas fa-arrows-rotate fa-lg text-base-content"></i>
      </button> -->

      <img v-if="colorScheme === 'dark'" class="object-cover h-6" src="../assets/DotX-darkmode.png">
      <img v-else class="object-cover h-6" src="../assets/DotX-lightmode.png">

      <h1 class="text-base-content">Decker</h1>
      <div>
        <i :class="connectionStatus ? 'text-green-400' : 'text-red-400'">●</i>
        <span class="text-sm text-base-content mx-2 capitalize">{{ connectionStatus ? 'Connected' : 'Disconnected' }}</span>
      </div>
    </div>
    <div class="flex flex-row justify-center top-0">
      <button title="Settings" @click="$emit('settings-toggled')" class="mx-8 btn btn-ghost rounded-md p-2">
        <i class="fas fa-gear fa-lg text-base-content"></i>
      </button>
      <button title="Minimize" @click="minimize" class="btn btn-ghost">
        <i class="fas fa-minus fa-lg text-base-content"></i>
      </button>
      <button title="Close" @click="close" class="btn btn-ghost text-base-content hover:text-white hover:bg-red-600 ">
        <i class="fas fa-close fa-lg "></i>
      </button>
    </div>
  </nav>
</template>

<script>

import { appWindow } from '@tauri-apps/api/window'

export default {
  name: 'TopBar',

  props: ["connection-status", "colorScheme"],

  emits: ["settings-toggled", "connect-to-board"],

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
