import { defineStore } from 'pinia';
import Stats from '../ts/stats.ts';
import eventBus from '../js/eventBus.js';

export const useDeckerStore = defineStore('decker', {
  state: () => ({
    sliders: [] as number[],
    prevSliders: [] as number[], //used to detect changes
    connected: false as boolean,
    channelSettings: {} as any,
  }),
  getters: {
    getSliders: (state) => state.sliders,
    getConnectionState: (state) => state.connected,
  },
  actions: {
    setSliders(sliders: number[]) {
      //map all values from 0-1023 to 0-100
      let change = false;
      sliders = sliders.map((value) => Math.round((value / 1023) * 100));
      sliders.forEach((value, index) => {
        if (value === this.prevSliders[index]) return;
        value = this.prevSliders[index] - value;
        change = true;
        //if the number is negative, make it positive
        if (value < 0) value = value * -1;
        Stats.logSliderChange(index, value);
      });
      this.sliders = sliders;
      if (change) eventBus.emit('slider-change', { changes: this.sliders.map((newValue, index) => ({ index, oldValue: this.prevSliders[index], newValue })), allSliders: this.sliders });
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
    }
  }

});
