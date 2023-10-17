<template>
  <div :class="modalOpen ? 'modal-open' : ''" class="modal h-full w-full">
    <div class="modal-box w-full max-w-xl h-2/3">
      <h1 class="font-bold text-lg text-center">Settings</h1>
      <div class="flex flex-row pt-3">
        <div class="text-left p-4">
          <ul class="menu rounded-box menu-compact p-2">
            <li v-for="tab in tabs" :key="tab">
              <a @click="selectTab(tab)" :class="{ active: activeTab === tab }">
                {{ tab }}
              </a>
            </li>
          </ul>
        </div>
        <div class="col-span-2 p-6">
          <component :is="activeTab" :key="activeTab" />
        </div>
      </div>
    </div>
    <div class="modal-action fixed bottom-5 left-1/2 transform -translate-x-1/2">
      <button @click="$emit('close')" class="btn mx-auto">Close</button>
    </div>
  </div>
</template>

<script>
import About from "./About.vue";
import General from "./General.vue";
import Connectivity from "./Connectivity.vue";


export default {
  name: "SettingsModal",

  emits: ["close"],

  components: {
    About,
    General,
    Connectivity
  },

  props: {
    modalOpen: Boolean,
  },

  data() {
    return {
      tabs: ['Connectivity', 'General', 'About'],
      activeTab: "Connectivity"
    };
  },

  methods: {
    selectTab(selectedTab) {
      this.activeTab = selectedTab
    },
  },

};
</script>

<style></style>
