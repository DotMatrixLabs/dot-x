import { defineStore } from "pinia";
import PluginsStore from "../ts/plugins";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "vue-sonner";

interface StoreState {
    activePlugins: Set<string>;
    enabledPlugins: Set<string>;
    approvedPlugins: Set<string>;
    connectedPlugins: Record<string, {
        id: string;
        name: string;
        version?: string;
        connected_at?: string;
    }>;
}

export const useStore = defineStore('store', {
    state: (): StoreState => ({
        activePlugins: new Set<string>(),
        enabledPlugins: new Set<string>(),
        approvedPlugins: new Set<string>(),
        connectedPlugins: {},
    }),
    getters: {
        getActivePlugins: (state) => state.activePlugins,
        getEnabledPlugins: (state) => state.enabledPlugins,
        getConnectedPlugins: (state) => state.connectedPlugins,
    },
    actions: {
        setActivePlugins(plugins: string[]) {
            this.activePlugins = new Set(plugins);
        },
        setConnectedPlugins(plugins: Array<{ id: string; name: string; version?: string; connected_at?: string }>) {
            const nextConnectedPlugins: StoreState['connectedPlugins'] = {};
            for (const plugin of plugins) {
                if (!plugin?.id) continue;
                nextConnectedPlugins[plugin.id] = plugin;
            }
            this.connectedPlugins = nextConnectedPlugins;
            this.activePlugins = new Set(Object.keys(nextConnectedPlugins));
        },
        addActivePlugin(plugin: string) {
            console.log("Adding active plugin", plugin);
            const next = new Set(this.activePlugins);
            next.add(plugin);
            this.activePlugins = next;
        },
        removeActivePlugin(plugin: string) {
            const next = new Set(this.activePlugins);
            next.delete(plugin);
            this.activePlugins = next;
        },
        getActivePlugins() {
            return Array.from(this.activePlugins);
        },
        upsertConnectedPlugin(plugin: { id: string; name: string; version?: string; connected_at?: string }) {
            if (!plugin?.id) return;
            this.connectedPlugins = {
                ...this.connectedPlugins,
                [plugin.id]: plugin,
            };
            this.addActivePlugin(plugin.id);
        },
        removeConnectedPlugin(pluginId: string) {
            const nextConnectedPlugins = { ...this.connectedPlugins };
            delete nextConnectedPlugins[pluginId];
            this.connectedPlugins = nextConnectedPlugins;
            this.removeActivePlugin(pluginId);
        },

        async loadEnabledPlugins() {
            const enabled = await PluginsStore.getEnabledPluginIds();
            this.enabledPlugins = new Set(enabled);
            const approved = await PluginsStore.getApprovedPluginIds();
            this.approvedPlugins = new Set(approved);
        },
        isPluginApproved(pluginId: string) {
            return this.approvedPlugins.has(pluginId);
        },
        async approvePlugin(pluginId: string) {
            await PluginsStore.approvePlugin(pluginId);
            const next = new Set(this.approvedPlugins);
            next.add(pluginId);
            this.approvedPlugins = next;
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
                    toast.error(`Failed to start plugin ${pluginId}: ${error}`);
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
