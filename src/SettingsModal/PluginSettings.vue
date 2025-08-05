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
        }
    }
</script>

<style scoped>

</style>