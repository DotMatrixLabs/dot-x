<template>
  <div class="w-full h-full">
    <div class="flex flex-row justify-evenly h-full p-24">
      <template v-for="(slider, index) in (sliders.length > 0 ? sliders : 5)" :key="index">
        <div class="flex flex-col justify-center">
          <Slider :midiEnabledGlobal="midiEnabledGlobal" :midiEnabled="midiEnabled[index]" :class="sliders.length === 0 || connectionState === false ? 'opacity-50' : 'opacity-100'" :slider-val="slider" class="h-full w-full" />
          <div v-if="sliders.length === 0 || connectionState === false" class="p-2 bg-base-200 rounded-md shadow-md ring-1 ring-gray-500 absolute text-center -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2">
            <h1>Device not connected</h1>
          <!-- If MIDI is enabled, show a message to inform that no programs or groups will have their volume applied. Only MIDI messages will work. -->
          </div>

          <button @click="$emit('app-click', index)"
            class="m-auto rounded-full w-24 h-12 mt-12 mx-1">
            <div class="">
              <ChannelLabel :key="index" :apps="sliderApps[index]?.apps" :channel="index" />
            </div>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import Slider from "./components/Slider.vue";
import _ from "lodash";
import SystemVolumeController from "./ts/volumeControl.ts";
import SelectedApps from "./ts/appsToControl.ts";
import Decker from "./ts/decker.ts";
import configStore from "./ts/config.ts";
import { useDeckerStore } from "./store/deckerStore.ts";
import { invoke } from "@tauri-apps/api/core";
import ChannelLabel from "./components/ChannelLabel.vue";

import { mapState } from "pinia"; 

// const sliderStore = useSliderStore();

export default {
  components: { Slider, ChannelLabel },
  props: {
    activeApp: {
      type: Object,
      default: {},
    },
  },

  emits: ["app-click"],

  data() {
    return {
      sliderApps: [
        { apps: [] },
      ],
      prevSliderValues: [],
      isWin10: true,
      midiEnabled: [], // Array of booleans, midiEnabled for every slider
      midiEnabledGlobal: false,
    };
  },

  computed: {
    ...mapState(useDeckerStore, {
      sliders: 'getSliders',
      connectionState: 'getConnectionState',
    }),
  },

  watch: {
      sliders: {
          handler: function () {
              this.sliders.forEach((sliderVol, index) => {
                if(this.prevSliderValues[index] === sliderVol) return;
                if(sliderVol === 0) sliderVol = 0.1;
                SystemVolumeController.setChannelVolume(index, sliderVol/100);
              });
              this.prevSliderValues = this.sliders;
              if(this.sliders.length !== this.sliderApps.length) {
                this.getSelectedApps();
              }
          },
          deep: false
      }
  },


  methods: {

    clickTest() {
      invoke('send_decker_command', { command: 'rgb-control', options: { r: 255, g: 255, b: 100 }});
    },

    async getSelectedApps() {
      let sliders = useDeckerStore().sliders;
      // console.log(sliders);
      if(sliders.length === 0) sliders = [0, 0, 0, 0, 0];
      sliders.forEach(async (slider, index) => {
        const selectedApps = await SelectedApps.getApps(index);
        // console.log( selectedApps );
        if(!selectedApps) return;
        if (!this.sliderApps[index]) {
          this.sliderApps[index] = { apps: selectedApps };
        } else {
          this.sliderApps[index].apps = selectedApps;
        }

        // Set midiEnabled to pass to the Slider component if it's enabled.
        this.midiEnabled[index] = selectedApps.some((app) => app.includes('midi'));
      });
    },

  },

  async mounted() {
    this.midiEnabledGlobal = await configStore.get('midiEnabled');
    configStore.store.onChange((key, value) => {
      if(key === 'midiEnabled'){
        this.midiEnabledGlobal = value;
      }
    });
    SystemVolumeController.getAllSessionNames();
    // SystemVolumeController.setChannelVolume('1', 0.5)
    this.getSelectedApps();
  },


};
</script>

<style scoped>

.text-xxs {
  font-size: 0.6rem;
}

</style>
./store/deckerStore.ts