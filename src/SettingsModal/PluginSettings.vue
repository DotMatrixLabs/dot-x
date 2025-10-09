<template>
  <div class="flex flex-col gap-4 w-full h-full overflow-y-auto p-2 pb-20">
    <PluginHeader v-if="plugin" :plugin="plugin" />

    <div class="flex flex-col gap-4">
      <PluginSettingsRenderer v-if="settings && settings.sections" :sections="settings" :pluginId="plugin.id" />
      <div v-else class="opacity-70 text-sm">No settings available.</div>
    </div>
  </div>
  
</template>

<script>
import PluginHeader from './PluginHeader.vue';
import pluginAPI from '../plugin-api/pluginAPI';
import PluginSettingsRenderer from '../components/PluginSettingsRenderer.vue';
import EventBus from '../js/eventBus';

    export default {
        name: "PluginSettings",
        components: { PluginHeader, PluginSettingsRenderer },
        props: {
            plugin: {
                type: Object,
                required: true
            }
        },
        data() {
            return {
                settings: {},
            }
        },
        methods: {

          async loadSettings() {
            const settings = await pluginAPI.getPluginSettings(this.plugin.id);
            console.log('Settings:', settings);
            this.settings = settings;
          },
            
        },
        computed: {
        },
        created() {
        },
        mounted() {
            this.loadSettings();
            // Refresh this plugin's settings when settings change events are emitted
            this._settingsUpdatedHandler = ({ pluginId }) => {
              if (!this.plugin || (pluginId && pluginId !== this.plugin.id)) return;
              this.loadSettings();
            };
            EventBus.on('plugin:settingsUpdated', this._settingsUpdatedHandler);
        },
        beforeUnmount() {
            if (this._settingsUpdatedHandler) {
              EventBus.off('plugin:settingsUpdated', this._settingsUpdatedHandler);
            }
        }
    }
</script>

<style scoped>
</style>