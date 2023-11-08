<template>
  <div class="h-screen w-screen flex flex-col pt-12 bg-base-200">
    <SettingsModal :modal-open="settingsModalOpen" @close="settingsToggled" />
    <AppsModal :currentSliderID="currentSliderID" :modal-open="appsModalOpen" @close="appsToggled(null)" />
    <TopBar @settings-toggled="settingsToggled" @connect-to-board="retryConnection" :connection-status="connectionStatus" />
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
    async getTheme() {
      this.currentTheme = await ConfigStore.get("theme") || "dark";
      document.documentElement.setAttribute("data-theme", this.currentTheme);
      return this.currentTheme;
    },

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
    this.getTheme();
    this.connectDecker();
  },
};
</script>
