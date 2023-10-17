<template>
  <nav class="w-screen h-12 bg-base-300 shadow-md items-center flex z-0 fixed top-0 flex-row justify-end"
    style="-webkit-app-region: drag">
    <!-- <img class="h-12 absolute -top-1 left-1/2 -translate-x-1/2 transform" src="../../assets/logos/decker-logo.svg"/> -->
    <button title="Retry connection" @click="$emit('connect-to-board')" class="mx-8 btn btn-ghost my-2 rounded-md p-2">
      <i class="fas fa-arrows-rotate fa-lg text-base-content"></i>
    </button>
    <span>
      <i :class="connectionDot">●</i>
      <span class="text-sm text-base-content mx-2 capitalize">{{ connectionStatus }}</span>
    </span>
    <button title="Settings" @click="$emit('settings-toggled')" class="mx-8 btn btn-ghost my-2 rounded-md p-2">
      <i class="fas fa-gear fa-lg text-base-content"></i>
    </button>
  </nav>
</template>

<script>

// import Store from '../../js/storage.mjs';

// const store = new Store;

export default {
  name: 'TopBar',

  props: ["connection-status"],

  emits: ["settings-toggled", "connect-to-board"],

  data() {
    return {
    }
  },

  computed: {
    connectionDot() {
      switch (this.connectionStatus) {
        case 'connected':
          return 'text-green-400'
        case 'connecting':
          return 'text-yellow-400'
        default:
          return 'text-red-400';
      }
    }
  },

  methods: {
    retryPressed() {
      // const port = store.get('config.comPort');
      // ipcRenderer.send('init-board', { path: port.path })
    }
  },

  mounted() {

    //Add listener to listen for board events
    // ipcRenderer.on("board-event", (event, arg) => {
      // console.log(event)
      // console.log(arg)
    // });
  },


}
</script>
