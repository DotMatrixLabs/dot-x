<template>
  <div :class="modalOpen ? 'modal-open' : ''" class="modal h-full w-full">
    <div class="modal-box w-full max-w-xl h-2/3 overflow-hidden">
      <button @click="$emit('close')" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"><i class="fa-solid fa-xmark"/></button>
      <h1 class="font-bold text-lg text-center">Settings</h1>
      <div class="flex flex-row pt-3 h-full">
        <div class="text-left p-4">
          <ul class="menu rounded-box menu-compact p-2">
            <li v-for="tab in tabs" :key="tab">
              <a @click="selectTab(tab)" :class="{ active: activeTab === tab }">
                {{ tab }}
              </a>
            </li>
          </ul>
        </div>
        <div class="col-span-2 w-full p-6 ">
          <component :modalOpen="modalOpen" :is="activeTab" :key="activeTab" />
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
import Device from "./Device.vue";
import Midi from "./Midi.vue";


export default {
  name: "SettingsModal",

  emits: ["close"],

  components: {
    About,
    General,
    Midi,
    Device,
  },

  props: {
    modalOpen: Boolean,
  },

  data() {
    return {
      tabs: ['Device', 'General', 'Midi', 'About'],
      activeTab: "Device"
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
