<template>
  <div :class="modalOpen ? 'modal-open' : ''" class="modal h-full w-full">
    <div class="modal-box w-full h-4/5 px-0 max-w-2xl max-h-[35rem] overflow-hidden">
      <button @click="$emit('close')" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"><i class="fa-solid fa-xmark"/></button>
      <h1 class="font-bold text-lg text-center">Settings</h1>
      <div class="flex flex-row pt-3 h-full">
        <div class="text-left p-2">
          <ul class="menu rounded-box menu-compact p-2">
            <li class="py-0.5" v-for="tab in tabs" :key="tab">
              <a @click="selectTab(tab)" :class="{ active: activeTab === tab }">
                {{ tab }}
              </a>
            </li>
            <label class="label-text text-xs mt-4 ml-4">Plugins</label>
            <li class="py-0.5" v-for="plugin in enabledPluginTabs" :key="plugin.id">
              <a @click="openSettings(plugin)" :class="{ active: activeTab === 'PluginSettings' && activePlugin?.id === plugin.id }">
                {{ plugin.name }}
              </a>
            </li>
          </ul>
        </div>
        <div class="col-span-2 w-full px-6 py-3 ">
          <component :modalOpen="modalOpen" :is="activeTab" :key="activeTab" :plugin="activePlugin" @openSettings="openSettings" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import About from "./About.vue";
import General from "./General.vue";
import Device from "./Device.vue";
import Midi from "./Midi.vue";
import Plugins from "./Plugins.vue";
import PluginSettings from "./PluginSettings.vue";
import { mapState } from "pinia";
import { useStore } from "../store/store";
import { invoke } from "@tauri-apps/api/tauri";

export default {
  name: "SettingsModal",

  emits: ["close"],

  components: {
    About,
    General,
    Midi,
    Device,
    Plugins,
    PluginSettings,
  },

  props: {
    modalOpen: Boolean,
  },

  data() {
    return {
      tabs: ['Device', 'General', 'Plugins', 'Midi', 'About'],
      activeTab: "Device",
      plugins: [],
      activePlugin: null,
    };
  },

  computed: {
    ...mapState(useStore, ['activePlugins', 'enabledPlugins']),
    enabledPluginTabs() {
      // Build simple tab list from enabled plugin IDs
      const ids = Array.from(this.enabledPlugins || []);
      // Attempt to match known plugins list by id to get nicer names; fallback to id
      return ids.map(id => {
        const match = this.plugins.find(p => p.id === id);
        return match ? match : { id, name: id };
      });
    }
  },

  mounted() {
    // Ensure enabled plugins are loaded from disk
    const store = useStore();
    store.loadEnabledPlugins?.();
    // Fetch connected plugin metadata for nicer tab names
    this.fetchPlugins();
  },

  methods: {
    async fetchPlugins() {
      try {
        const connected = await invoke('get_connected_plugins');
        if (Array.isArray(connected)) {
          this.plugins = connected.map((p) => ({
            id: p.id,
            name: p.name || p.id,
            version: p.version,
            author: p.author,
            description: p.description,
          }));
        }
      } catch (e) {
        console.error('Failed to fetch connected plugins', e);
      }
    },
    selectTab(selectedTab) {
      this.activeTab = selectedTab
    },
    openSettings(plugin) {
      this.activeTab = "PluginSettings"
      this.activePlugin = plugin
    }
  },

};
</script>

<style></style>
