import { defineStore } from 'pinia';

export const useDeckerStore = defineStore('decker', {
  state: () => ({
    sliders: [] as number[],
    connected: false as boolean,
  }),
  getters: {
    getSliders: (state) => state.sliders,
    getConnectionState: (state) => state.connected,
  },
  actions: {
    setSliders(sliders: number[]) {
      //map all values from 0-1023 to 0-100
      sliders = sliders.map((value) => Math.round((value / 1023) * 100));
      this.sliders = sliders;
    },

    setConnected(status: boolean) {
      this.connected = status;
    },
  },
});
