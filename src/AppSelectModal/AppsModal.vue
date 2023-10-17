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
        <ActionModal :modalOpen="actionModalOpen" :modalSettings="modalSettings" @closeModal="actionModalOpen = false"
          @outputData="appAdded" />
        <div class="col-span-2 pb-6 pt-2">
          <div v-if="tabs[0].isActive">
            <Programs />
          </div>
          <div v-if="tabs[1].isActive" class="flex flex-col space-y-3">
            <!-- General -->
            <div class="flex space-x-2">
              <span>Theme: </span>
              <select @change="setTheme" v-model="currentTheme"
                class="grow select select-bordered select-sm w-2/3 capitalize focus:border-none">
                <option v-for="(theme, index) in themes" :value="theme" :key="index">
                  {{ theme }}
                </option>
              </select>
            </div>

            <!-- input and output manager start -->
            <div class="flex space-x-2">
              <label for="audio-device-select">Audio Device:</label>
              <select id="audio-device-select" v-model="selectedDeviceId" @change="selectAudioDevice(selectedDeviceId)"
                class="grow select select-bordered select-sm w-2/3 capitalize focus:border-none">
                <option v-for="device in audioDevices" :key="device.deviceId" :value="device.deviceId">
                  {{ device.label }}
                </option>
              </select>
            </div>

            <div class="flex space-x-2">
              <label for="output-device-select">Output Device:</label>
              <select id="output-device-select" v-model="outputDeviceId" @change="setOutputDevice(outputDeviceId)"
                class="grow select select-bordered select-sm w-2/3 capitalize focus:border-none">
                <option v-for="device in audioDevices" :key="device.deviceId" :value="device.deviceId">
                  {{ device.label }}
                </option>
              </select>
            </div>
            <!-- input and output manager end -->
          </div>
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

// import { useMicrophoneStore } from "../store/microphoneStore";


const toast = useToast();

// const boardManager = new BoardManager();
// const store = new StorageHandler();

export default {
  components: {
    Programs,

  },

  name: "SettingsModal",

  emits: ["close", "appSelected"],

  props: {
    modalOpen: Boolean,
  },

  data() {
    return {
      tabs: [
        {
          name: "Programs",
          isActive: true,
        },
        {
          name: "System Utilities",
        },
      ],
    };
  },

  methods: {
    selectTab(selectedTab) {
      this.tabs.forEach((tab) => {
        tab.isActive = tab == selectedTab;
      });
    },

  },

  // created() {
  //   const microphone = useMicrophoneStore();
  //   microphone.getAudioDevices();
  // },
};
</script>

<style></style>
