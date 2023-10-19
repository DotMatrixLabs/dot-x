<template>
  <div :class="modalOpen ? 'modal-open' : ''" class="modal h-full w-full">
    <div class="modal-box overflow-hidden w-full max-w-xl h-2/3">
      <h1 class="font-bold text-lg text-center">Apps</h1>
      <div class="w-full">
        <ul class="menu rounded-box menu-compact p-2 flex flex-row w-full justify-center gap-2">
          <li v-for="tab in tabs" :key="tab">
            <a @click="selectTab(tab)" class="w-full text-center" :class="{ active: tab.isActive }">{{ tab.name }}</a>
          </li>
        </ul>
        <div class="col-span-2 pb-6 pt-2">
          <component :ref="tabs[0].isActive ? 'programs' : 'systemDevicesSelector'" :currentSliderID="currentSliderID" :key="tabs[0].isActive ? 'Programs' : 'SystemDevicesSelector'" :is="tabs[0].isActive ? 'Programs' : 'SystemDevicesSelector'" />
        </div>
      </div>

    </div>
    <div class="modal-action fixed bottom-5 left-1/2 transform -translate-x-1/2">
      <button @click="$emit('close')" class="btn mx-auto">Close</button>
    </div>
  </div>
</template>

<script>
// import BoardManager from "../../js/boardManager.js";
// import StorageHandler from "../../js/storage.mjs";
import { useToast } from "vue-toastification";

import _ from "lodash";
// import LoadingSpinner from "../assets/loadingSpinner.vue";

import Programs from "./Programs.vue"
import SystemDevicesSelector from "./SystemDevicesSelector.vue"

// import { useMicrophoneStore } from "../store/microphoneStore";


const toast = useToast();


// const boardManager = new BoardManager();
// const store = new StorageHandler();

export default {
  components: {
    Programs,
    SystemDevicesSelector
  },

  name: "SettingsModal",

  emits: ["close", "appSelected"],

  props: {
    modalOpen: Boolean,
    currentSliderID: Number,
  },

  data() {
    return {
      tabs: [ { name: "Programs", isActive: true }, { name: "System Utilities" } ], 
    };
  },

  methods: {
    selectTab(selectedTab) {
      this.tabs.forEach((tab) => {
        tab.isActive = tab == selectedTab;
      });
    },

  },

  updated() {
    this.$refs?.programs?.refreshData();
  },

  // created() {
  //   const microphone = useMicrophoneStore();
  //   microphone.getAudioDevices();
  // },
};
</script>

<style></style>
