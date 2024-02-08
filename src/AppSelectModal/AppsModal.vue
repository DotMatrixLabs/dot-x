<template>
  <div :class="modalOpen ? 'modal-open' : ''" class="modal h-full w-full">
    <div class="modal-box overflow-hidden w-full max-w-xl h-2/3">
      <h1 class="font-bold text-lg text-center">Apps</h1>
      <div class="w-full">
        <ul class="menu rounded-box menu-compact p-2 flex flex-row w-full justify-center gap-2">
          <template v-for="tab in tabs" :key="tab">
            <li v-if="!tab.hide">
              <a @click="selectTab(tab)" class="w-full text-center" :class="{ active: tab.isActive }">{{ tab.name }}</a>
            </li>
          </template>
        </ul>
        <div class="col-span-2 pb-6 pt-2">
          <component
            :is="currentTab.component"
            :ref="currentTab.component"
            :key="currentTab.name"
            :currentSliderID="currentSliderID"
          />        
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
import SystemUtilitiesSelector from "./SystemUtilitiesSelector.vue"
import Midi from "./Midi.vue"
import config from "../ts/config";

// import { useMicrophoneStore } from "../store/microphoneStore";


const toast = useToast();


// const boardManager = new BoardManager();
// const store = new StorageHandler();

export default {
  components: {
    Programs,
    SystemUtilitiesSelector,
    Midi
  },

  name: "SettingsModal",

  emits: ["close", "appSelected"],

  props: {
    modalOpen: Boolean,
    currentSliderID: Number,
  },

  data() {
    return {
      tabs: [
        { name: 'Programs', component: 'Programs', isActive: true },
        { name: 'System Utilities', component: 'SystemUtilitiesSelector'},
        { name: 'Midi', component: 'Midi', hide: true}
      ],
      midiEnabledGlobal: false,
    };
  },

  methods: {
    selectTab(selectedTab) {
      this.tabs.forEach((tab) => {
        tab.isActive = tab == selectedTab;
      });
    },

    async getMidiEnabledGlobal() {
      this.midiEnabledGlobal = await config.get("midiEnabled");
      const midiTab = this.tabs.find(tab => tab.name === "Midi").hide = !this.midiEnabledGlobal;
    },

  },

  updated() {
    this.getMidiEnabledGlobal();
    this.$refs?.Programs?.refreshData();
    this.$refs?.SystemUtilitiesSelector?.getActiveDevices();
    this.$refs?.Midi?.refreshData();

    if(this.currentTab.hide) this.selectTab(this.tabs[0]); // If the current tab is hidden, select the first tab (Programs, which can never be hidden, so it's safe to assume it's there)
  },

  // created() {
  //   const microphone = useMicrophoneStore();
  //   microphone.getAudioDevices();
  // },
  computed: {
    currentTab() {
      return this.tabs.find(tab => tab.isActive) || this.tabs[0];
    },
  },
};
</script>

<style></style>
