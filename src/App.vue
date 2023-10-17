<template>
  <div class="h-screen w-screen flex flex-col pt-12 bg-base-200">
    <SettingsModal :modal-open="settingsModalOpen" @close="settingsToggled" />
    <AppsModal :modal-open="appsModalOpen" @close="appsToggled" @app-selected="setActiveApp" />
    <TopBar @settings-toggled="settingsToggled" @connect-to-board="connect" :connection-status="connectionStatus" />
    <SliderOverview :active-app="activeApp" :pot-values="potValues" @app-click="appsToggled" />
  </div>
</template>

<script>
import TopBar from "./components/TopBar.vue";
import SettingsModal from "./SettingsModal/SettingsModal.vue";
import AppsModal from "./AppSelectModal/AppsModal.vue";
import SliderOverview from "./SliderOverview.vue";
import { useToast } from "vue-toastification";

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
      activeApp: null,
    };
  },

  methods: {
    // getTheme() {
    //   this.currentTheme = store.get("config.theme") || "dark";
    //   document.documentElement.setAttribute("data-theme", this.currentTheme);
    //   return this.currentTheme;
    // },

    settingsToggled() {
      this.settingsModalOpen = !this.settingsModalOpen;
    },
    appsToggled() {
      this.appsModalOpen = !this.appsModalOpen;
    },
    // connect() {
    //   const port = store.get("config.comPort");
    //   this.connectionStatus = "connecting";
    //   ipcRenderer.send("init-board", {
    //     path: port.path,
    //     pots: [
    //       { id: 0, pin: "A0" },
    //       { id: 1, pin: "A1" },
    //     ],
    //   });
    // },
    // setActiveApp(app) {
    //   console.log({ listening: app });
    //   console.log(app?.DisplayIcon);

    //   this.activeApp = app;
    // },
  },

  mounted() {

    this.getTheme();

  },
};
</script>
