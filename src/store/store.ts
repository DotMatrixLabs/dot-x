import { defineStore } from "pinia";
import PluginsStore from "../ts/plugins";
import {
    createPluginApprovalRecord,
    getPluginApprovalKey,
    type PluginApprovalTarget,
} from "../ts/pluginApproval";
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
        async getPluginStartupFailureReason(pluginId: string) {
            try {
                const rawLogs = await invoke<string>('get_plugin_logs', { pluginId });
                if (!rawLogs || typeof rawLogs !== 'string') {
                    return null;
                }

                const lines = rawLogs
                    .split('\n')
                    .map((line) => line.trim())
                    .filter((line) => line.length > 0)
                    .filter((line) => !line.toLowerCase().includes('no logs available'))
                    .filter((line) => !line.toLowerCase().includes('logs will appear'))
                    .filter((line) => !line.toLowerCase().includes('make sure the plugin is running'));

                const lastLine = lines.length > 0 ? lines[lines.length - 1] : null;
                if (!lastLine) {
                    return null;
                }

                return lastLine.length > 180 ? `${lastLine.slice(0, 177)}...` : lastLine;
            } catch (error) {
                console.error(`Failed to read startup logs for plugin ${pluginId}:`, error);
                return null;
            }
        },
        async rollbackEnabledPlugin(pluginId: string) {
            if (!this.enabledPlugins.has(pluginId)) {
                return;
            }

            const next = new Set(this.enabledPlugins);
            next.delete(pluginId);
            this.enabledPlugins = next;
            await PluginsStore.setEnabledPluginIds(Array.from(this.enabledPlugins));
        },
        async waitForPluginActive(pluginId: string, timeoutMs = 4000) {
            const startedAt = Date.now();

            while (Date.now() - startedAt < timeoutMs) {
                if (this.activePlugins.has(pluginId)) {
                    return true;
                }

                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            return this.activePlugins.has(pluginId);
        },
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
            const approved = await PluginsStore.getApprovedPluginRecords();
            this.approvedPlugins = new Set(
                approved
                    .map((entry) => getPluginApprovalKey(entry))
                    .filter((entry): entry is string => Boolean(entry))
            );
        },
        isPluginApproved(target: PluginApprovalTarget) {
            const approvalKey = getPluginApprovalKey(createPluginApprovalRecord(target));
            return approvalKey ? this.approvedPlugins.has(approvalKey) : false;
        },
        async approvePlugin(target: PluginApprovalTarget) {
            const approvalRecord = await PluginsStore.approvePlugin(target);
            const approvalKey = getPluginApprovalKey(approvalRecord);
            if (!approvalKey) {
                return;
            }
            const next = new Set(this.approvedPlugins);
            next.add(approvalKey);
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
                
                // Start from a clean slate so retries are not blocked by a stale process.
                try {
                    await invoke('stop_plugin', { pluginId });
                } catch (error) {
                    console.error(`Failed to stop plugin ${pluginId} before restart:`, error);
                }

                // Start the plugin
                try {
                    await invoke('start_plugin', { pluginId });
                } catch (error) {
                    await this.rollbackEnabledPlugin(pluginId);
                    console.error(`Failed to start plugin ${pluginId}:`, error);
                    toast.error(`Failed to start plugin ${pluginId}: ${error}`);
                    return false;
                }

                const connected = await this.waitForPluginActive(pluginId);
                if (!connected) {
                    await this.rollbackEnabledPlugin(pluginId);
                    try {
                        await invoke('stop_plugin', { pluginId });
                    } catch (error) {
                        console.error(`Failed to clean up plugin ${pluginId} after startup timeout:`, error);
                    }
                    const reason = await this.getPluginStartupFailureReason(pluginId);
                    toast.error(
                        reason
                            ? `Plugin ${pluginId} failed to start: ${reason}`
                            : `Plugin ${pluginId} did not connect after startup. Check plugin logs for details.`
                    );
                    return false;
                }
            }
            return true;
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
