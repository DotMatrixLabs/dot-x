import { defineStore } from 'pinia';
import Stats from '../ts/stats.ts';
import ConfigStore from '../ts/config.ts';
import { invoke } from "@tauri-apps/api/tauri";

export const useDeckerStore = defineStore('decker', {
  state: () => ({
    sliders: [] as number[],
    prevSliders: [] as number[], //used to detect changes
    connected: false as boolean,
    channelSettings: {} as any,
    deviceType: 'Unknown' as string,
    rgbBrightness: 100 as number,
    mappedApps: {} as Record<string, string[]>,
    volumeSyncEnabled: false as boolean,
  }),
  getters: {
    getSliders: (state) => state.sliders,
    getConnectionState: (state) => state.connected,
    getDeviceType: (state) => state.deviceType,
    getRGBBrightness: (state) => state.rgbBrightness,
    getAllMappedApps: (state) => {
      let apps: string[] = [];
      Object.values(state.mappedApps).forEach((sliderApps) => {
        apps = [...apps, ...sliderApps];
      });
      return apps;
    },
    getVolumeSyncEnabled: (state) => state.volumeSyncEnabled,
  },
  actions: {
    setSliders(sliders: number[]) {
      //map all values from 0-1023 to 0-100
      sliders = sliders.map((value) => Math.round((value / 1023) * 100));
      sliders.forEach((value, index) => {
        if (value === this.prevSliders[index]) return;
        value = this.prevSliders[index] - value;
        //if the number is negative, make it positive
        if (value < 0) value = value * -1;
        Stats.logSliderChange(index, value);
      });
      this.sliders = sliders;
      this.prevSliders = sliders;
    },

    setConnected(status: boolean) {
      this.connected = status;
    },

    setChannelSettings(settings: any) {
      this.channelSettings = settings;
    },

    updateChannelSetting(channelID: string, newSettings = {}) {
      this.channelSettings[channelID] = newSettings;
    },

    setDeviceType(type: string) {
      this.deviceType = type;
    },

    async setBrightness(brightness: number) {
      this.rgbBrightness = brightness;
      await ConfigStore.set("RGBBrightness", brightness);
      await ConfigStore.save();
    },

    async loadBrightness() {
      const savedBrightness = await ConfigStore.get("RGBBrightness") ?? 100;
      this.rgbBrightness = savedBrightness;
    },

    async setMappedApps(sliderID: string, apps: string[]) {
      this.mappedApps[sliderID] = apps;
      if (this.volumeSyncEnabled) {
        await invoke("update_volume_sync_mappings", { sessionNames: this.getAllMappedApps });
      }
    },

    async setAllMappedApps(allApps: Record<string, string[]>) {
      this.mappedApps = allApps;
      if (this.volumeSyncEnabled) {
        await invoke("update_volume_sync_mappings", { sessionNames: this.getAllMappedApps });
      }
    },

    async setVolumeSyncEnabled(enabled: boolean) {
      this.volumeSyncEnabled = enabled;
      if (enabled) {
        await invoke('enable_volume_sync');
        await invoke("update_volume_sync_mappings", { sessionNames: this.getAllMappedApps });
      } else {
        await invoke('disable_volume_sync');
      }
    }
  }
});
