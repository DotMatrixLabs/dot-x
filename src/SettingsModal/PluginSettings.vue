<template>
  <div class="flex flex-col gap-4 w-full">
    <PluginHeader v-if="plugin" :plugin="plugin" />

    <div class="flex flex-col gap-2">
      <h3 class="text-base">Plugin Settings</h3>
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