<template>
  <div class="w-full h-full">
    <div class="flex flex-row justify-evenly h-full p-24">
      <template v-for="slider in sliders" :key="slider.id">
        <div class="flex flex-col justify-center">
          <Slider :slider-val="slider.value" class="h-full w-full" />
          <!-- <img class="w-12 mt-12 rounded-full shadow" @click="$emit('app-click')" v-if="activeAppIconPath"
            :src="`${activeAppIconPath}`" alt="" /> -->

          <button @click="$emit('app-click', slider.id)"
            class="m-auto rounded-full w-24 h-12 bg-gray-400 bg-opacity-50 ring-opacity-50 mt-12 btn mx-1">
            <span v-if="sliderChannelName(slider.id)" class="text-white text-xxs text-center truncate">{{ sliderChannelName(slider.id) }}</span>
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
      sliders: [
        { id: 0, value: 0 },
        { id: 1, value: 25 },
        { id: 2, value: 50 },
        { id: 3, value: 75 },
        { id: 4, value: 100 },
      ],
    };
  },

  methods: {

    sliderChannelName(sliderID){
      const apps = this.sliders[sliderID]?.apps;
      if(!apps) return;
      if(apps.length > 1) return `${apps[0]}+${apps.length - 1}`;
      else return apps[0];
      console.log(apps)
    },

    async getSelectedApps() {
      this.sliders.forEach(async (slider) => {
        const selectedApps = await SelectedApps.getApps(slider.id);
        console.log( selectedApps );
        if(!selectedApps) return;
        this.sliders[slider.id].apps = selectedApps;
      });
    },

    setSliderValue(sliderID, value) {
      this.sliders[sliderID].value = value;
    },


  },

  mounted() {
    SystemVolumeController.getAllSessionNames();
    // SystemVolumeController.setChannelVolume('1', 0.5)
    this.getSelectedApps();
    // boardManager.initBoard(store.get('config.comPort').path)

    setInterval(() => {
      this.setSliderValue(0, Decker.sliders[0] / 1023 * 100);
      this.setSliderValue(1, Decker.sliders[1] / 1023 * 100);
      this.setSliderValue(2, Decker.sliders[2] / 1023 * 100);
      this.setSliderValue(3, Decker.sliders[3] / 1023 * 100);
      this.setSliderValue(4, Decker.sliders[4] / 1023 * 100);
    }, 10);
  },


};
</script>

<style scoped>

.text-xxs {
  font-size: 0.6rem;
}

</style>
