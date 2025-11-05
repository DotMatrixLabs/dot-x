import { defineStore } from "pinia";
import PluginsStore from "../ts/plugins";
import { invoke } from "@tauri-apps/api/core";

interface StoreState {
    activePlugins: Set<string>;
    enabledPlugins: Set<string>;
}

export const useStore = defineStore('store', {
    state: (): StoreState => ({
        activePlugins: new Set<string>(),
        enabledPlugins: new Set<string>(),
    }),
    getters: {
        getActivePlugins: (state) => state.activePlugins,
        getEnabledPlugins: (state) => state.enabledPlugins,
    },
    actions: {
        setActivePlugins(plugins: string[]) {
            this.activePlugins = new Set(plugins);
        },
        addActivePlugin(plugin: string) {
            console.log("Adding active plugin", plugin);
            this.activePlugins.add(plugin);
        },
        removeActivePlugin(plugin: string) {
            this.activePlugins.delete(plugin);
        },
        getActivePlugins() {
            return Array.from(this.activePlugins);
        },

        async loadEnabledPlugins() {
            const enabled = await PluginsStore.getEnabledPluginIds();
            this.enabledPlugins = new Set(enabled);
        },
        async setEnabledPlugins(plugins: string[]) {
            this.enabledPlugins = new Set(plugins);
            await PluginsStore.setEnabledPluginIds(plugins);
        },
        async enablePluginId(pluginId: string) {
            if (!this.enabledPlugins.has(pluginId)) {
                const next = new Set(this.enabledPlugins);
                next.add(pluginId);
                this.enabledPlugins = next;
                await PluginsStore.setEnabledPluginIds(Array.from(this.enabledPlugins));
                
                // Start the plugin
                try {
                    await invoke('start_plugin', { pluginId });
                } catch (error) {
                    console.error(`Failed to start plugin ${pluginId}:`, error);
                }
            }
        },
        async disablePluginId(pluginId: string) {
            if (this.enabledPlugins.has(pluginId)) {
                const next = new Set(this.enabledPlugins);
                next.delete(pluginId);
                this.enabledPlugins = next;
                await PluginsStore.setEnabledPluginIds(Array.from(this.enabledPlugins));
                
                // Stop the plugin
                try {
                    await invoke('stop_plugin', { pluginId });
                } catch (error) {
                    console.error(`Failed to stop plugin ${pluginId}:`, error);
                }
            }
        },
        isPluginEnabled(pluginId: string) {
            return this.enabledPlugins.has(pluginId);
        }
    }
})