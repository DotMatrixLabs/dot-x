<template>
  <div class="w-full">
    <div class="flex items-start justify-between gap-3">
      <div class="flex flex-col min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h2 class="text-base font-semibold leading-tight truncate">{{ plugin?.name || plugin?.id }}</h2>
          <div v-if="plugin?.version" class="badge badge-outline badge-sm">v{{ plugin.version }}</div>
          <div class="badge badge-ghost badge-sm">ID: {{ plugin?.id }}</div>
        </div>
        <p class="label-text text-xs mt-1" v-if="author">
          by <span class="font-medium">{{ author }}</span>
        </p>
        
        <!-- <div class="mt-2 mb-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div class="form-control md:col-span-2" v-if="permissions && permissions.length">
            <label class="label">
              <span class="label-text text-xs">Permissions</span>
            </label>
            <div class="flex flex-wrap gap-2 w-full">
              <div v-for="perm in permissions" :key="perm" class="badge badge-outline badge-sm opacity-70">{{ perm }}</div>
            </div>
          </div>
        </div> -->
      </div>

      <div class="shrink-0 flex items-center gap-1">
        <div class="tooltip tooltip-bottom" data-tip="Marketplace">
          <a :href="marketplaceHref" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-xs btn-square">
            <i class="fa-solid fa-store" />
          </a>
        </div>
        <div class="tooltip tooltip-bottom" data-tip="Logs">
          <button class="btn btn-ghost btn-xs btn-square" @click="openLogs">
            <i class="fa-solid fa-file-lines" />
          </button>
        </div>
        <div class="badge badge-sm" :class="statusClass">{{ statusLabel }}</div>
      </div>
    </div>

    <!-- Bottom actions row: up to 4 custom links -->
    <div class="flex flex-nowrap items-center gap-2 mt-2 overflow-x-auto pb-1">
      <a v-for="(link, idx) in limitedLinks" :key="idx" :href="link.url" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-xs flex-shrink-0">
        <i :class="[link.icon || 'fa-solid fa-link', 'mr-1']" /> {{ link.title || 'Link' }}
      </a>
    </div>

    <div class="divider my-1"></div>

    <!-- Logs Modal -->
    <div v-if="showLogs" class="modal modal-open">
      <div class="modal-box max-w-3xl h-[70vh]">
        <h3 class="font-bold text-lg">{{ plugin?.name || plugin?.id }} Logs</h3>
        <div class="mt-2 h-[55vh] overflow-auto bg-base-300 text-base-content p-3 rounded">
          <pre class="text-xs whitespace-pre-wrap">{{ logsText }}</pre>
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showLogs = false">Close</button>
        </div>
      </div>
    </div>

  </div>
  
</template>

<script>
import { invoke } from '@tauri-apps/api/tauri';
import { mapState } from 'pinia';
import { useStore } from '../store/store';

export default {
  name: 'PluginHeader',
  props: {
    plugin: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      showLogs: false,
      logsText: 'Loading logs...\nIf nothing appears, logs may not be available for this plugin.',
    };
  },
  computed: {
    ...mapState(useStore, ['activePlugins']),
    manifest() {
        console.log(this.plugin);
      return this.plugin?.manifest || this.plugin || {};
    },
    author() {
      return this.plugin?.author || this.manifest.author || null;
    },
    longDescription() {
      return this.manifest.longDescription || this.manifest.description || this.plugin?.description || null;
    },
    permissions() {
      return this.manifest.permissions || [];
    },
    isRunning() {
      try {
        return this.activePlugins?.has?.(this.plugin?.id);
      } catch (e) {
        return false;
      }
    },
    hasError() {
      // Use optional fields if provided by upstream; falls back to false
      return Boolean(this.plugin?.error || this.manifest?.status === 'error');
    },
    status() {
      if (this.hasError) return 'error';
      if (this.isRunning) return 'running';
      return 'stopped';
    },
    statusLabel() {
      if (this.status === 'running') return 'Running';
      if (this.status === 'error') return 'Error';
      if (this.status === 'stopped') return 'Stopped';
      return 'Unknown';
    },
    statusClass() {
      if (this.status === 'running') return 'badge-success';
      if (this.status === 'error') return 'badge-error';
      if (this.status === 'stopped') return 'badge-neutral';
      return 'badge-ghost';
    },
    marketplaceUrl() {
      return this.manifest.marketplaceUrl || this.manifest.homepage || null;
    },
    marketplaceHref() {
      return this.marketplaceUrl || '#';
    },

    
    limitedLinks() {
      const raw = this.manifest.links;
      if (!raw) return [];
      const arr = Array.isArray(raw) ? raw : (typeof raw === 'object' ? Object.values(raw) : []);
      const normalized = arr
        .map((l) => {
          if (typeof l === 'string') return { title: 'Link', icon: 'fa-solid fa-link', url: l };
          if (l && typeof l === 'object') return { title: l.title || 'Link', icon: l.icon || 'fa-solid fa-link', url: l.url };
          return null;
        })
        .filter((l) => l && l.url);
      return normalized.slice(0, 4);
    },
    
    
  },
  methods: {
    async openLogs() {
      this.showLogs = true;
      try {
        // Attempt backend log fetch if available
        const maybe = await invoke('get_plugin_logs', { pluginId: this.plugin.id });
        if (maybe) {
          this.logsText = typeof maybe === 'string' ? maybe : JSON.stringify(maybe, null, 2);
        } else {
          this.logsText = 'No logs available.';
        }
      } catch (_e) {
        this.logsText = 'No logs available.';
      }
      this.$emit('logs-opened', { id: this.plugin.id });
    },
  },
};
</script>

<style scoped>
</style>


