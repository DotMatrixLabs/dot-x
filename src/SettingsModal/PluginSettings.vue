<template>
  <div class="flex flex-col gap-4 w-full">
    <PluginHeader v-if="plugin" :plugin="plugin" />

    <div class="card bg-secondary rounded-box shadow-sm">
      <div class="card-body p-4 gap-2">
        <h3 class="card-title text-base">Plugin-specific settings</h3>
        <p class="label-text">Settings UI for this plugin will appear here.</p>
      </div>
    </div>
  </div>
  
</template>

<script>
import PluginHeader from './PluginHeader.vue';

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
            }
        },
        methods: {
            
        }
    }
</script>

<style scoped>

</style>