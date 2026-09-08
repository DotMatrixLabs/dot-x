<template>
    <div :class="modalOpen ? 'modal-open' : ''" class="modal h-full w-full">
      <div class="modal-box w-full max-w-xl h-full overflow-y-auto">
        <button  @click="$emit('close')" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        <h1 class="font-bold text-lg text-center">Travel distance</h1>
        <p class="text-sm font-light opacity-50 text-center">Just for fun, here is the length each of your sliders has traveled in its lifetime!</p>
        <div class="flex flex-col pt-3 h-2/3 justify-center items-center">
            <div v-for="stat in stats" :key="stat" class="flex w-1/3 m-auto justify-between flex-row">
                <span class="">Slider {{stat?.index + 1}}:</span>
                <span class="">{{stat?.distance}}</span>
            </div>
        </div>
      </div>
    </div>
  </template>
  
  <script>

  import Stats from "../ts/stats.ts";
  import { useDeckerStore } from "../store/deckerStore.ts";
  import { mapState } from "pinia";

  export default {
    name: "Statspanel",
  
    emits: ["close"],
  
    computed: {
        ...mapState(useDeckerStore, {
            sliders: 'getSliders',
        }),
    },

    watch: {
        sliders: {
            handler() {
                this.updateStats();
            },
            deep: true,
        }
    },
  
    props: {
      modalOpen: Boolean,
    },
  
    data() {
      return {
        stats: [],
      };
    },
  
    methods: {

        updateStats() {
            this.sliders.forEach(async (slider, index) => {
                const distance = await Stats.getSliderDistance(index);
                this.stats[index].distance = distance;
            });
        },

        getStats() {
            this.sliders.forEach(async (slider, index) => {
                const distance = await Stats.getSliderDistance(index);
                this.stats.push({index, distance});
            });
        }

    },

    mounted() {
        this.getStats();
    }
  
  };
  </script>

<style scoped>
</style>
