<template>
  <div class="h-screen w-screen flex flex-col pt-12 bg-transparent rounded-xl">
    <SettingsModal :modal-open="settingsModalOpen" @close="settingsToggled" />
    <AppsModal :currentSliderID="currentSliderID" :modal-open="appsModalOpen" @close="appsToggled(null)" />
    <TopBar @settings-toggled="settingsToggled" @connect-to-board="retryConnection" :connection-status="connectionState" />
    <SliderOverview ref="sliderOverview" :pot-values="potValues" @app-click="appsToggled" />
  </div>
</template>

<script>
import TopBar from "./components/TopBar.vue";
import SettingsModal from "./SettingsModal/SettingsModal.vue";
import AppsModal from "./AppSelectModal/AppsModal.vue";
import SliderOverview from "./SliderOverview.vue";
import { useToast } from "vue-toastification";
import ConfigStore from "./ts/config.ts";
import Decker from "./ts/decker.ts";
import RGBController from "./ts/RGBController";
import { useDeckerStore } from "./store/deckerStore.ts";

import { mapState } from "pinia"; 

const toast = useToast();

export default {
  components: { TopBar, SettingsModal, SliderOverview, AppsModal },
  name: "App",

  data() {
    return {
      settingsModalOpen: false,
      appsModalOpen: false,
      connectionStatus: "not connected",
      potValues: null,
      currentSliderID: null,
    };
  },

  computed: {
    ...mapState(useDeckerStore, {
      connectionState: 'getConnectionState',
    }),
  },

  methods: {
    // async getTheme() {
    //   this.currentTheme = await ConfigStore.get("theme") || "dark";
    //   document.documentElement.setAttribute("data-theme", this.currentTheme);
    //   return this.currentTheme;
    // },

    settingsToggled() {
      this.settingsModalOpen = !this.settingsModalOpen;
    },
    appsToggled(id) {
      this.currentSliderID = id;
      this.appsModalOpen = !this.appsModalOpen;
      this.$refs.sliderOverview.getSelectedApps();
    },

   async connectDecker(){
    const comPort = await ConfigStore.get("comPort");
    if(!comPort) {
      return toast.info("Please select a device in the settings");
    }
    Decker.init(comPort);
   },

   retryConnection() {
    if(this.connectionState === true) return toast.info("Decker is already connected");
    Decker.retryConnection();
   }

  },

  mounted() {
    // this.getTheme();
    this.connectDecker();
    Decker.detectDeviceChanges();
    Decker.initMidi();


    this.colorScheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

    document.documentElement.setAttribute("data-theme", this.colorScheme);
    console.log(this.colorScheme);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      console.log(event.matches ? "dark" : "light");
      this.colorScheme = event.matches ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", this.colorScheme);
    });
  },
};
</script>

<style>

:root, [data-theme] {
  background: none !important;
  background-color: transparent !important;
}

@media (prefers-color-scheme: light) {
  .modal-box  {
    background: rgba(255, 255, 255, 0.9) !important;
    background-color: none !important;
    color: black !important;
    border-radius: 16px;
    box-shadow: 0 4px 30px rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(9.2px);
    -webkit-backdrop-filter: blur(9.2px);
    border: 1px solid rgba(166, 166, 166, 0.3);
  }
}


@media (prefers-color-scheme: dark) {
  .modal-box  {
    background: rgba(23, 23, 23, 0.95) !important;
    background-color: none !important;
    border-radius: 16px;
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(9.2px);
    -webkit-backdrop-filter: blur(9.2px);
    border: 1px solid rgba(44, 44, 44, 0.3);
  }
}

</style>
