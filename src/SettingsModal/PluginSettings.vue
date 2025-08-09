<template>
  <div class="flex flex-col gap-4 w-full">
    <PluginHeader v-if="plugin" :plugin="plugin" />

    <div class="flex flex-col gap-2">
      <h3 class="text-base">Plugin Settings</h3>
      {{ settings }}
    </div>
  </div>
  
</template>

<script>
import PluginHeader from './PluginHeader.vue';
import pluginAPI from '../plugin-api/pluginAPI';

    export default {
        name: "PluginSettings",
        components: { PluginHeader },
        props: {
            plugin: {
                type: Object,
                required: true
            }
        },
        data() {
            return {
                settings: {}
            }
        },
        methods: {

          async loadSettings() {
            const settings = await pluginAPI.getPluginSettings(this.plugin.id);
            console.log('Settings:', settings);
            this.settings = settings;
          }
            
        },
        mounted() {
            this.loadSettings();
        }
    }
</script>

<style scoped>

</style>