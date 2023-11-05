import { defineStore } from 'pinia';

export const useDeckerStore = defineStore('decker', {
  state: () => ({
    sliders: [] as number[],
  }),
  getters: {
    getSliders: (state) => state.sliders,
  },
  actions: {
    setSliders(sliders: number[]) {
      //map all values from 0-1023 to 0-100
      sliders = sliders.map((value) => Math.round((value / 1023) * 100));
      this.sliders = sliders;
    },
  },
});
