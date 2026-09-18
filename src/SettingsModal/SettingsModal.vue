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
            <template v-if="sidebarSearch.trim()">
              <p v-if="filteredSettings.length === 0 && filteredTabs.length === 0 && filteredPluginTabs.length === 0" class="text-xs opacity-50 px-2 pt-2">No results</p>
              <template v-if="filteredTabs.length > 0">
                <p class="label-text text-xs mt-2 ml-1 mb-0.5 opacity-60">Tabs</p>
                <button
                  v-for="tab in filteredTabs"
                  :key="tab"
                  @click="selectTab(tab)"
                  class="flex items-center w-full px-2 py-1.5 rounded-btn text-sm text-left hover:bg-base-content/10 transition-colors"
                  :class="activeTab === tab ? 'bg-primary text-primary-content hover:bg-primary' : ''"
                >
                  {{ tab }}
                </button>
              </template>
              <template v-if="filteredSettings.length > 0">
                <p class="label-text text-xs mt-3 ml-1 mb-0.5 opacity-60">Settings</p>
                <button
                  v-for="setting in filteredSettings"
                  :key="setting.tab + setting.label"
                  @click="goToSetting(setting)"
                  class="flex flex-col items-start w-full px-2 py-1.5 rounded-btn text-sm text-left hover:bg-base-content/10 transition-colors"
                  :class="activeTab === setting.tab ? 'bg-primary text-primary-content hover:bg-primary' : ''"
                >
                  <span>{{ setting.label }}</span>
                  <span class="text-xs opacity-60" :class="activeTab === setting.tab ? 'opacity-80' : ''">{{ setting.tabLabel || setting.tab }}</span>
                </button>
              </template>
              <template v-if="filteredPluginTabs.length > 0">
                <p class="label-text text-xs mt-3 ml-1 mb-0.5 opacity-60">Plugins</p>
              <button
                v-for="plugin in filteredPluginTabs"
                :key="plugin.id"
                @click="openSettings(plugin)"
                class="flex items-center w-full px-2 py-1.5 rounded-btn text-sm text-left hover:bg-base-content/10 transition-colors min-w-0"
                :class="activeTab === 'PluginSettings' && activePlugin?.id === plugin.id ? 'bg-primary text-primary-content hover:bg-primary' : ''"
                :disabled="plugin.isStarting"
              >
                <span class="truncate">{{ plugin.name }}</span>
                <span v-if="plugin.isStarting" class="flex items-center gap-1 text-xs opacity-70 ml-auto shrink-0">
                  <span class="loading loading-spinner loading-xs"></span>
                  Loading...
                </span>
                <span v-if="plugin.external" class="badge badge-outline badge-info badge-xs ml-auto shrink-0">External</span>
              </button>
              </template>
            </template>
            <template v-else>
              <button
                v-for="tab in tabs"
                :key="tab"
                @click="selectTab(tab)"
                class="flex items-center w-full px-2 py-1.5 rounded-btn text-sm text-left hover:bg-base-content/10 transition-colors"
                :class="activeTab === tab ? 'bg-primary text-primary-content hover:bg-primary' : ''"
              >
                {{ tab }}
              </button>
              <p v-if="visiblePluginTabs.length > 0" class="label-text text-xs mt-3 ml-1 mb-0.5">Plugins</p>
              <button
                v-for="plugin in visiblePluginTabs"
                :key="plugin.id"
                @click="openSettings(plugin)"
                class="flex items-center w-full px-2 py-1.5 rounded-btn text-sm text-left hover:bg-base-content/10 transition-colors min-w-0"
                :class="activeTab === 'PluginSettings' && activePlugin?.id === plugin.id ? 'bg-primary text-primary-content hover:bg-primary' : ''"
                :disabled="plugin.isStarting"
              >
                <span class="truncate">{{ plugin.name }}</span>
                <span v-if="plugin.isStarting" class="flex items-center gap-1 text-xs opacity-70 ml-auto shrink-0">
                  <span class="loading loading-spinner loading-xs"></span>
                  Loading...
                </span>
                <span v-if="plugin.external" class="badge badge-outline badge-info badge-xs ml-auto shrink-0">External</span>
              </button>
            </template>
          </div>
        </div>
        <div class="col-span-2 w-full min-h-0 px-6 pt-12 flex flex-col">
          <div class="flex-1 min-h-0 flex flex-col">
            <component
              :modalOpen="modalOpen"
              :is="activeTab"
              :key="activeTab === 'PluginSettings' && activePlugin ? `PluginSettings-${activePlugin.id}` : activeTab"
              :plugin="activePlugin"
              @openSettings="openSettings"
              @installed-plugins-changed="handleInstalledPluginsChanged"
            />
          </div>
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
import { usePluginStore } from "../store/pluginStore";
import { invoke } from "@tauri-apps/api/core";
import pluginAPI from "../plugin-api/pluginAPI";
import { createLogger } from '../ts/logger.ts';

const log = createLogger('settings');

const BASE_SETTINGS_INDEX = [
  { label: "Device", tab: "Device" },
  { label: "RGB Effect", tab: "Device" },
  { label: "Static color", tab: "Device" },
  { label: "Breathing effect", tab: "Device" },
  { label: "RGB Speed", tab: "Device" },
  { label: "Brightness", tab: "Device" },
  { label: "Turn off LEDs on Sleep", tab: "Device" },
  { label: "Device Info", tab: "Device" },
  { label: "Run on startup", tab: "General" },
  { label: "Act when Decker disconnects", tab: "General" },
  { label: "Inverted sliders", tab: "General" },
  { label: "Reset Channel Settings", tab: "General" },
  { label: "Reset All Settings", tab: "General" },
  { label: "Enable MIDI Output", tab: "Midi" },
  { label: "MIDI Port", tab: "Midi" },
  { label: "MIDI documentation", tab: "Midi" },
  { label: "Install plugins", tab: "Plugins" },
  { label: "Uninstall plugins", tab: "Plugins" },
];

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
      installedPlugins: [],
      activePlugin: null,
      sidebarSearch: "",
      settingsIndex: [...BASE_SETTINGS_INDEX],
    };
  },

  computed: {
    ...mapState(usePluginStore, ['activePlugins', 'startingPlugins', 'connectedPlugins']),
    visiblePluginTabs() {
      const installedById = new Map(
        (this.installedPlugins || []).map((plugin) => [
          plugin.id,
          {
            ...plugin,
            name: plugin.name || plugin.id,
            external: false,
          },
        ])
      );
      const visibleIds = new Set([
        ...Array.from(this.activePlugins || []),
        ...Array.from(this.startingPlugins || []),
      ]);

      return Array.from(visibleIds)
        .map((id) => {
          const isStarting = this.startingPlugins?.has?.(id) && !this.activePlugins?.has?.(id);
          const installedPlugin = installedById.get(id);
          if (installedPlugin) {
            return { ...installedPlugin, isStarting };
          }

          const connectedPlugin = this.connectedPlugins?.[id];
          if (!connectedPlugin) {
            return { id, name: id, external: false, isStarting };
          }

          return {
            ...connectedPlugin,
            description: 'Connected externally',
            external: true,
            isStarting,
          };
        })
        .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
    },
    pluginTabsKey() {
      return this.visiblePluginTabs
        .map((plugin) => `${plugin.id}:${this.activePlugins?.has?.(plugin.id) ? 'active' : 'inactive'}:${plugin.isStarting ? 'starting' : 'idle'}`)
        .sort()
        .join('|');
    },
    filteredTabs() {
      const q = this.sidebarSearch.trim().toLowerCase();
      if (!q) return this.tabs;
      return this.tabs.filter(t => t.toLowerCase().includes(q));
    },
    filteredPluginTabs() {
      const q = this.sidebarSearch.trim().toLowerCase();
      if (!q) return this.visiblePluginTabs;
      return this.visiblePluginTabs.filter(p => p.name.toLowerCase().includes(q));
    },
    filteredSettings() {
      const q = this.sidebarSearch.trim().toLowerCase();
      if (!q) return [];
      return this.settingsIndex.filter(s => {
        const labelMatch = s.label.toLowerCase().includes(q);
        const tabAlreadyShown = this.filteredTabs.includes(s.tab);
        return labelMatch && !tabAlreadyShown;
      });
    }
  },

  mounted() {
    // Ensure enabled plugins are loaded from disk
    const pluginStore = usePluginStore();
    pluginStore.loadPersistedPluginState?.();
    this.fetchPlugins();
  },

  methods: {
    async fetchPlugins() {
      try {
        const installed = await invoke('list_installed_plugins');
        if (Array.isArray(installed)) {
          this.installedPlugins = installed;
          await this.indexPluginSettings();
        }
      } catch (e) {
        log.error('Failed to list installed plugins', e);
      }
    },
    handleInstalledPluginsChanged(installedPlugins) {
      this.installedPlugins = Array.isArray(installedPlugins) ? installedPlugins : [];
      if (this.activePlugin?.id) {
        const nextActivePlugin = this.visiblePluginTabs.find((plugin) => plugin.id === this.activePlugin.id);
        if (nextActivePlugin) {
          this.activePlugin = nextActivePlugin;
        }
      }
      this.indexPluginSettings();
    },
    async indexPluginSettings() {
      this.settingsIndex = [...BASE_SETTINGS_INDEX];
      for (const plugin of this.visiblePluginTabs) {
        if (!this.activePlugins?.has?.(plugin.id)) continue;
        try {
          const settings = await pluginAPI.getPluginSettings(plugin.id);
          if (!settings?.sections) continue;
          for (const section of settings.sections) {
            if (!section.components) continue;
            for (const comp of section.components) {
              const label = comp.label || comp.name || comp.title || comp.key;
              if (!label) continue;
              this.settingsIndex.push({ label, tab: 'PluginSettings', tabLabel: plugin.name, plugin });
            }
          }
        } catch (e) {
          // Plugin settings are only available while the plugin is connected.
        }
      }
    },
    selectTab(selectedTab) {
      this.activeTab = selectedTab
    },
    async goToSetting(setting) {
      if (setting.plugin) {
        this.openSettings(setting.plugin);
      } else {
        this.selectTab(setting.tab);
      }
      await this.$nextTick();
      await this.$nextTick();
      const el = this.$el.querySelector(`[data-setting="${setting.label}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('setting-highlight');
        setTimeout(() => el.classList.remove('setting-highlight'), 1400);
      }
    },
    openSettings(plugin) {
      if (plugin?.isStarting || !this.visiblePluginTabs.some((candidate) => candidate.id === plugin?.id)) {
        return;
      }
      this.activeTab = "PluginSettings"
      this.activePlugin = plugin
    }
  },
  watch: {
    pluginTabsKey() {
      this.indexPluginSettings();
      if (this.activeTab === 'PluginSettings' && this.activePlugin && !this.visiblePluginTabs.some((plugin) => plugin.id === this.activePlugin.id)) {
        this.activeTab = 'Plugins';
        this.activePlugin = null;
      }
    },
  },

};
</script>

<style>
@keyframes setting-flash {
  0%   { background-color: oklch(var(--p) / 0.25); border-radius: 6px; }
  70%  { background-color: oklch(var(--p) / 0.25); border-radius: 6px; }
  100% { background-color: transparent; }
}
.setting-highlight {
  animation: setting-flash 1.4s ease-out forwards;
}
</style>
