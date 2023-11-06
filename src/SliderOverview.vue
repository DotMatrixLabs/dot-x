<template>
  <div class="w-full h-full">
    <div class="flex flex-row justify-evenly h-full p-24">
      <template v-for="(slider, index) in (sliders.length > 0 ? sliders : 5)" :key="index">
        <div class="flex flex-col justify-center">
          <Slider :class="sliders.length === 0 ? 'opacity-50' : 'opacity-100'" :slider-val="slider" class="h-full w-full" />
          <div v-if="sliders.length === 0" class="p-2 bg-base-200 rounded-md shadow-md ring-1 ring-gray-500 absolute text-center -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2">
          <h1>Decker not connected</h1>
          </div>

          <button @click="$emit('app-click', index)"
            class="m-auto rounded-full w-24 h-12 bg-gray-400 bg-opacity-50 ring-opacity-50 mt-12 btn mx-1">
            <span v-if="sliderChannelName(index)" class="text-white text-xxs text-center truncate">{{ sliderChannelName(index) }}</span>
            <span v-else><i class="fas fa-add fa-xl"></i></span>
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
import { useDeckerStore } from "./store/deckerStore.ts";

import { mapState } from "pinia"; 

// const sliderStore = useSliderStore();

export default {
  components: { Slider },
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
    };
  },

  computed: {
    ...mapState(useDeckerStore, {
      sliders: 'getSliders',
    }),
  },

  watch: {
      sliders: {
          handler: function () {
              this.sliders.forEach((sliderVol, index) => {
                if(this.prevSliderValues[index] === sliderVol) return;
                if(sliderVol === 0) sliderVol = 1;
                SystemVolumeController.setChannelVolume(index, sliderVol / 100);
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

    sliderChannelName(sliderID){
      const apps = this.sliderApps[sliderID]?.apps;
      if(!apps) return;
      if(apps.length > 1) return `${apps[0]}+${apps.length - 1}`;
      else return apps[0];
    },

    async getSelectedApps() {
      let sliders = useDeckerStore().sliders;
      console.log(sliders);
      if(sliders.length === 0) sliders = [0, 0, 0, 0, 0];
      sliders.forEach(async (slider, index) => {
        const selectedApps = await SelectedApps.getApps(index);
        console.log( selectedApps );
        if(!selectedApps) return;
        if (!this.sliderApps[index]) {
          this.sliderApps[index] = { apps: selectedApps };
        } else {
          this.sliderApps[index].apps = selectedApps;
        }
        console.log(this.sliderApps);
      });
    },

  },

  mounted() {

    SystemVolumeController.getAllSessionNames();
    // SystemVolumeController.setChannelVolume('1', 0.5)
    this.getSelectedApps();
    // boardManager.initBoard(store.get('config.comPort').path)

    // setInterval(() => {
    //   if(Decker.sliders.length === 0) return;
    //   if(Decker.sliders[0] / 1023 * 100 != this.sliders[0].value) {
    //     console.log('change?', Decker.sliders[0] / 1023 * 100, this.sliders[0].value);
    //     this.setSliderValue(0, Decker.sliders[0] / 1023 * 100);
    //     SystemVolumeController.setChannelVolume('0', this.sliders[0].value / 100);
    //   }
    //   if(Decker.sliders[1] / 1023 * 100 != this.sliders[1].value) {
    //     this.setSliderValue(1, Decker.sliders[1] / 1023 * 100);
    //     SystemVolumeController.setChannelVolume('1', this.sliders[1].value / 100);
    //   }
    //   if(Decker.sliders[2] / 1023 * 100 != this.sliders[2].value) {
    //     this.setSliderValue(2, Decker.sliders[2] / 1023 * 100);
    //     SystemVolumeController.setChannelVolume('2', this.sliders[2].value / 100);
    //   }
    //   if(Decker.sliders[3] / 1023 * 100 != this.sliders[3].value) {
    //     this.setSliderValue(3, Decker.sliders[3] / 1023 * 100);
    //     SystemVolumeController.setChannelVolume('3', this.sliders[3].value / 100);
    //   }
    //   if(Decker.sliders[4] / 1023 * 100 != this.sliders[4].value) {
    //     this.setSliderValue(4, Decker.sliders[4] / 1023 * 100);
    //     SystemVolumeController.setChannelVolume('4', this.sliders[4].value / 100);
    //   }
    // }, 20);
  },


};
</script>

<style scoped>

.text-xxs {
  font-size: 0.6rem;
}

</style>
./store/deckerStore.ts