<template>
    <div>
        <h1>Plugin Settings</h1>
        <p>Plugin Name: {{ plugin.name }}</p>
        <p>Plugin Version: {{ plugin.version }}</p>
        <p>Plugin Author: {{ plugin.author }}</p>
        <p>Plugin Description: {{ plugin.description }}</p>
        <p>Plugin Enabled: {{ plugin.enabled }}</p>
    </div>
</template>

<script>
import { PluginAPI } from '../plugin-api/pluginAPI';

    export default {
        name: "PluginSettings",
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
            async getPluginSettings() {
                console.log("Getting plugin settings for", this.plugin.id);
                const settings = await PluginAPI.getPluginSettings(this.plugin.id);
                this.pluginSettings = settings;
                console.log(this.pluginSettings);
            }
        }
    }
</script>

<style scoped>

</style>