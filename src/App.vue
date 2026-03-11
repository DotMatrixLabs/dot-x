<template>
  <div class="h-screen w-screen flex flex-col pt-12 bg-transparent rounded-xl">
    <SettingsModal :modal-open="settingsModalOpen" @close="settingsToggled" />
    <AppsModal :currentSliderID="currentSliderID" :modal-open="appsModalOpen" @close="appsToggled(null)" />
    <TopBar :colorScheme="colorScheme" :class="backgroundColorTopBar" @settings-toggled="settingsToggled" :connection-status="connectionState" />
    <SliderOverview :class="backgroundColor" ref="sliderOverview" :pot-values="potValues" @app-click="appsToggled" />

    <!-- Plugin UI Components -->
    <Plugin />
    <Toaster position="bottom-right" :theme="colorScheme" rich-colors />
  </div>
</template>

<script>
import TopBar from "./components/TopBar.vue";
import SettingsModal from "./SettingsModal/SettingsModal.vue";
import AppsModal from "./AppSelectModal/AppsModal.vue";
import SliderOverview from "./SliderOverview.vue";
import Plugin from "./Plugins/Plugin.vue";
import { Toaster, toast } from "vue-sonner";
import ConfigStore from "./ts/config.ts";
import Decker from "./ts/decker.ts";
import RGBController from "./ts/RGBController";
import { useDeckerStore } from "./store/deckerStore.ts";
import PluginAPI from "./plugin-api/pluginAPI";
import { mapState } from "pinia";
import { version } from '@tauri-apps/plugin-os';

export default {
  components: { TopBar, SettingsModal, SliderOverview, AppsModal, Plugin, Toaster },
  name: "App",

  data() {
    return {
      settingsModalOpen: false,
      appsModalOpen: false,
      connectionStatus: "not connected",
      potValues: null,
      currentSliderID: null,
      colorScheme: "dark",
      isWin10: true,
    };
  },

  computed: {
    ...mapState(useDeckerStore, {
      connectionState: 'getConnectionState',
    }),

    backgroundColor() {
      if(this.isWin10) return "bg-base-100";
      return "bg-transparent";
    },

    
    backgroundColorTopBar() {
      if(this.isWin10) return "bg-base-400 bg-opacity-20";
      return "bg-black bg-opacity-10 ";
    },


  },

  methods: {

    async setThemeFromOS() {
      this.isWin10 = this.getWindowsVersion(version()) === 'Windows 10';
    },

    getWindowsVersion(kernelVersion) {
      const win11KernelVersion = 22000;

      const versionArray = kernelVersion.split('.').map(Number);
      const kernel = versionArray[2] || versionArray[1]; // Handle both formats

      if (kernel >= win11KernelVersion) {
          return 'Windows 11';
      } else {
          return 'Windows 10';
      }
    },
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

    async connectDecker() {
      try {
        const comPort = await ConfigStore.get("comPort");
        if (!comPort) {
          return toast.info("Please select a device in the settings");
        }
        Decker.init(comPort);
      } catch (error) {
        toast.error("Failed to connect to Device");
      }
    },

    //this disables the built in right click context menu in build mode
    disableContextMenu() {
      if (window.location.hostname !== 'tauri.localhost') return;
      document.addEventListener('contextmenu', (event) => event.preventDefault(), { capture: true });
    },

  },

  async mounted() {
    await PluginAPI.initialize();
    console.log("Plugin server started");
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.disableContextMenu();
    // this.getTheme();
    this.connectDecker();
    Decker.detectDeviceChanges();
    Decker.initMidi();

    this.colorScheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

    this.setThemeFromOS();

    document.documentElement.setAttribute("data-theme", this.colorScheme);
    console.log(this.colorScheme);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      console.log(event.matches ? "dark" : "light");
      this.colorScheme = event.matches ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", this.colorScheme);
    });
  },

  beforeUnmount() {
    // Plugin UI cleanup is handled automatically
  },
};
</script>