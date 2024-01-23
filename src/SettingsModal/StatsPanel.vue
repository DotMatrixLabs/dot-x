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
        <!-- Share buttons -->
        <!-- <div class="flex flex-row justify-center mt-8">
            <button :href="socialButton.link" :key="socialButton" v-for="socialButton in socialButtons" class="social">
                <i :class="socialButton.icon" class="fa-lg text-base-content"></i>
            </button>
        </div> -->
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
        socialButtons: [
            {name: 'X', icon: 'fab fa-x-twitter', link: 'https://twitter.com/intent/tweet?text=I%20just%20found%20out%20that%20my%20Decker%20has%20traveled%20{{stat?.distance}}%20inches%20in%20its%20lifetime!%20Check%20out%20Decker%20at%20https://decker.app!'},
            {name: 'LinkedIn', icon: 'fab fa-linkedin', link: 'https://www.linkedin.com/shareArticle?mini=true&url=https://decker.app&title=Decker%20-%20The%20Ultimate%20MIDI%20Controller&summary=I%20just%20found%20out%20that%20my%20Decker%20has%20traveled%20{{stat?.distance}}%20inches%20in%20its%20lifetime!%20Check%20out%20Decker%20at%20https://decker.app!&source='},
            {name: 'Discord', icon: 'fab fa-discord', link: 'https://discord.com/channels/@me'},
        ],
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

.social{
    @apply btn btn-sm btn-circle btn-ghost;
}

</style>
  