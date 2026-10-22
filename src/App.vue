<template>
  <div class="h-screen w-screen flex flex-col pt-12 bg-transparent rounded-xl">
    <SettingsModal :modal-open="settingsModalOpen" @close="settingsToggled" />
    <AppsModal :currentSliderID="currentSliderID" :modal-open="appsModalOpen" @close="appsToggled(null)" />
    <UpdatePrompt />
    <WhatsNewModal />
    <TopBar :colorScheme="colorScheme" :class="backgroundColorTopBar" @settings-toggled="settingsToggled" :connection-status="connectionState" />
    <SliderOverview :class="backgroundColor" ref="sliderOverview" :pot-values="potValues" @app-click="appsToggled" />

    <!-- Plugin UI Components -->
    <Plugin />
    <Toaster position="bottom-right" :theme="colorScheme" rich-colors />

    <!-- .dotx install modal (shown when a plugin file is opened) -->
    <DotxInstallModal ref="dotxInstallModal" />
  </div>
</template>

<script>
import TopBar from "./components/TopBar.vue";
import UpdatePrompt from "./components/UpdatePrompt.vue";
import WhatsNewModal from "./components/WhatsNewModal.vue";
import SettingsModal from "./SettingsModal/SettingsModal.vue";
import AppsModal from "./AppSelectModal/AppsModal.vue";
import SliderOverview from "./SliderOverview.vue";
import Plugin from "./Plugins/Plugin.vue";
import DotxInstallModal from "./components/DotxInstallModal.vue";
import { Toaster, toast } from "vue-sonner";
import ConfigStore from "./ts/config.ts";
import Decker from "./ts/decker.ts";
import RGBController from "./ts/RGBController";
import { useDeckerStore } from "./store/deckerStore.ts";
import { usePluginStore } from "./store/pluginStore";
import PluginAPI from "./plugin-api/pluginAPI";
import { mapState } from "pinia";
import { version } from '@tauri-apps/plugin-os';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { createLogger } from './ts/logger.ts';
import { initUpdater } from './ts/updater';
import { useUpdateStore } from './store/updateStore';

const log = createLogger('app');

import SelectedApps from "./ts/appsToControl.ts";
import ChannelSettings from "./ts/channelSettings.ts";

export default {
  components: { TopBar, SettingsModal, SliderOverview, AppsModal, UpdatePrompt, WhatsNewModal, Plugin, Toaster, DotxInstallModal },
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

    openDotxFile(filePath) {
      this.$refs.dotxInstallModal.open(filePath);
    },

    settingsToggled() {
      this.settingsModalOpen = !this.settingsModalOpen;
    },

    appsToggled(id) {
      this.currentSliderID = id;
      this.appsModalOpen = !this.appsModalOpen;
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
    // Not awaited on purpose: everything that reads or writes the mirrored mappings
    // awaits SelectedApps.ready(), so a selection made while this runs isn't lost.
    SelectedApps.init().catch((error) => log.error('Failed to load mapped apps', error));
    ChannelSettings.init().catch((error) => log.error('Failed to load channel settings', error));

    try {
      if (await ConfigStore.get('allowWindowResizing') === true) {
        await getCurrentWindow().setResizable(true);
      }
    } catch (error) {
      log.error('Failed to restore window resizing preference', error);
    }

    await PluginAPI.initialize();

    // Listen for .dotx files opened while the app is already running.
    listen('dotx-open-file', (event) => {
      this.openDotxFile(event.payload);
    });

    // Pick up a .dotx file that was passed when the app was launched fresh.
    const pendingPath = await invoke('consume_pending_dotx_install').catch(() => null);
    if (pendingPath) {
      this.openDotxFile(pendingPath);
    }
    const pluginStore = usePluginStore();
    await pluginStore.loadPersistedPluginState();
    pluginStore.markEnabledPluginsStarting();
    void pluginStore.refreshPluginUpdates();
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.disableContextMenu();
    this.connectDecker();
    Decker.detectDeviceChanges();
    Decker.initMidi();

    this.colorScheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

    this.setThemeFromOS();
    // updater bootstrap
    initUpdater();
    const updateStore = useUpdateStore();
    const post = updateStore.shouldShowWhatsNewOnLaunch();
    if (post.show) {
      updateStore.changelogHtml = post.html;
      updateStore.whatsNewOpen = true;
      updateStore.markWhatsNewShownFor(post.version);
    }

    document.documentElement.setAttribute("data-theme", this.colorScheme);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      this.colorScheme = event.matches ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", this.colorScheme);
    });
  },

  beforeUnmount() {
    // Plugin UI cleanup is handled automatically
  },
};
</script>
