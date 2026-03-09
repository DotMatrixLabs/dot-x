<template>
  <div :class="modalOpen ? 'modal-open' : ''" class="modal h-full w-full">
    <div class="modal-box w-full h-4/5 px-0 pt-0 max-w-2xl max-h-[35rem] overflow-hidden relative rounded-md flex flex-col">
      <div class="absolute left-0 top-0 bottom-0 w-48 bg-gray-800/10 pointer-events-none border-r border-black/10"></div>
      <button @click="$emit('close')" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"><i class="fa-solid fa-xmark"/></button>
      <div class="flex flex-row flex-1 min-h-0">
        <div class="text-left w-48 flex flex-col min-h-0 overflow-hidden shrink-0">
          <h1 class="font-bold text-lg px-3 pt-3 pb-2 shrink-0">Settings</h1>
          <div class="px-2 pb-2 shrink-0">
            <div class="relative">
              <input
                type="text"
                class="input input-bordered input-xs pl-6 w-full"
                placeholder="Search..."
                v-model="sidebarSearch"
              />
              <i class="fa-solid fa-magnifying-glass absolute left-2 top-1/2 -translate-y-1/2 opacity-40 text-xs"></i>
            </div>
          </div>
          <div class="flex flex-col overflow-y-auto flex-1 pt-0 pb-1 gap-0.5 px-2">
            <button
              v-for="tab in filteredTabs"
              :key="tab"
              @click="selectTab(tab)"
              class="flex items-center w-full px-2 py-1.5 rounded-btn text-sm text-left hover:bg-base-content/10 transition-colors"
              :class="activeTab === tab ? 'bg-primary text-primary-content hover:bg-primary' : ''"
            >
              {{ tab }}
            </button>
            <p v-if="filteredPluginTabs.length > 0" class="label-text text-xs mt-3 ml-1 mb-0.5">Plugins</p>
            <button
              v-for="plugin in filteredPluginTabs"
              :key="plugin.id"
              @click="openSettings(plugin)"
              class="flex items-center w-full px-2 py-1.5 rounded-btn text-sm text-left hover:bg-base-content/10 transition-colors min-w-0"
              :class="activeTab === 'PluginSettings' && activePlugin?.id === plugin.id ? 'bg-primary text-primary-content hover:bg-primary' : ''"
            >
              <span class="truncate">{{ plugin.name }}</span>
            </button>
          </div>
        </div>
        <div class="col-span-2 w-full px-6 pt-16 pb-3">
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
import { invoke } from "@tauri-apps/api/core";

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
      sidebarSearch: "",
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
    },
    filteredTabs() {
      const q = this.sidebarSearch.trim().toLowerCase();
      if (!q) return this.tabs;
      return this.tabs.filter(t => t.toLowerCase().includes(q));
    },
    filteredPluginTabs() {
      const q = this.sidebarSearch.trim().toLowerCase();
      if (!q) return this.enabledPluginTabs;
      return this.enabledPluginTabs.filter(p => p.name.toLowerCase().includes(q));
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
        const installed = await invoke('list_installed_plugins');
        console.log(installed);
        if (Array.isArray(installed)) {
          this.plugins = installed;
        }
      } catch (e) {
        console.error('Failed to list installed plugins', e);
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
