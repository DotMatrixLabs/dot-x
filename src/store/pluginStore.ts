import { defineStore } from "pinia";
import PluginStorage, { type PluginUpdateRecord } from "../ts/pluginStorage";
import {
    createPluginApprovalRecord,
    getPluginApprovalKey,
    type PluginApprovalTarget,
} from "../ts/pluginApproval";
import { MARKETPLACE_REGISTRY_URL } from "../ts/marketplaceStats";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "vue-sonner";

const UNEXPECTED_PLUGIN_DISCONNECT_GRACE_MS = 1500;
const PLUGIN_STARTING_TIMEOUT_MS = 10000;
const pendingUnexpectedDisconnects = new Map<string, ReturnType<typeof setTimeout>>();
const expectedPluginDisconnects = new Map<string, ReturnType<typeof setTimeout>>();
const startingPluginTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const lifecycleFailureNotifiedAt = new Map<string, number>();
let refreshPluginUpdatesPromise: Promise<Record<string, PluginUpdateRecord>> | null = null;

function normalizeErrorMessage(error: unknown): string | null {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === "string") {
        const trimmed = error.trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    if (error == null) {
        return null;
    }

    const asString = String(error).trim();
    return asString.length > 0 ? asString : null;
}

function extractPluginFailureReason(rawLogs: string | null): string | null {
    if (!rawLogs || typeof rawLogs !== "string") {
        return null;
    }

    const lines = rawLogs
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => line.replace(/^\[(stdout|stderr)\]\s*/i, "").trim())
        .filter((line) => !line.toLowerCase().includes("no logs available"))
        .filter((line) => !line.toLowerCase().includes("logs will appear"))
        .filter((line) => !line.toLowerCase().includes("make sure the plugin is running"))
        .filter((line) => !/^connected to plugin server$/i.test(line))
        .filter((line) => !/^waiting for connection to be established/i.test(line))
        .filter((line) => !/^plugin connecting to server/i.test(line));

    if (lines.length === 0) {
        return null;
    }

    const prioritizedLine = [...lines]
        .reverse()
        .find((line) => /(error|exception|panic|uncaught|failed|refused|invalid)/i.test(line));
    const reason = prioritizedLine || lines[lines.length - 1];
    return reason.length > 220 ? `${reason.slice(0, 217)}...` : reason;
}

interface PluginConnectionInfo {
    id: string;
    name: string;
    version?: string;
    connected_at?: string;
    sdkVersion?: string;
    hostApiVersion?: string;
    capabilities?: string[];
}

export interface PluginLifecycleEvent {
    id: string;
    name?: string;
    version?: string;
    connected_at?: string;
    sdkVersion?: string;
    hostApiVersion?: string;
    capabilities?: string[];
    status: "starting" | "connected" | "start_failed" | "exited" | "stopped";
    error?: string | null;
    exitCode?: number | null;
    signal?: string | null;
    expected?: boolean;
}

interface PluginStoreState {
    activePlugins: Set<string>;
    startingPlugins: Set<string>;
    enabledPlugins: Set<string>;
    approvedPlugins: Set<string>;
    checkingForPluginUpdates: boolean;
    lastPluginUpdateCheckAt: string | null;
    pluginUpdates: Record<string, PluginUpdateRecord>;
    connectedPlugins: Record<string, PluginConnectionInfo>;
}

export const usePluginStore = defineStore("pluginStore", {
    state: (): PluginStoreState => ({
        activePlugins: new Set<string>(),
        startingPlugins: new Set<string>(),
        enabledPlugins: new Set<string>(),
        approvedPlugins: new Set<string>(),
        checkingForPluginUpdates: false,
        lastPluginUpdateCheckAt: null,
        pluginUpdates: {},
        connectedPlugins: {},
    }),
    getters: {
        getActivePlugins: (state) => state.activePlugins,
        getStartingPlugins: (state) => state.startingPlugins,
        getEnabledPlugins: (state) => state.enabledPlugins,
        getConnectedPlugins: (state) => state.connectedPlugins,
        getPluginUpdates: (state) => state.pluginUpdates,
    },
    actions: {
        async loadPersistedPluginState() {
            const persistedState = await PluginStorage.loadPersistedPluginState();
            this.enabledPlugins = new Set(persistedState.enabledPluginIds);
            this.approvedPlugins = new Set(
                persistedState.approvedRecords
                    .map((entry) => getPluginApprovalKey(entry))
                    .filter((entry): entry is string => Boolean(entry)),
            );
            this.pluginUpdates = persistedState.pluginUpdates;
            this.lastPluginUpdateCheckAt = persistedState.lastPluginUpdateCheckAt;
        },
        async refreshPluginUpdates(options: { silent?: boolean } = {}) {
            const { silent = true } = options;

            if (refreshPluginUpdatesPromise) {
                return refreshPluginUpdatesPromise;
            }

            this.checkingForPluginUpdates = true;
            refreshPluginUpdatesPromise = (async () => {
                try {
                    const updates = await invoke<Array<PluginUpdateRecord>>("check_marketplace_plugin_updates", {
                        registryUrl: MARKETPLACE_REGISTRY_URL,
                    });
                    const nextUpdates: Record<string, PluginUpdateRecord> = {};
                    for (const update of Array.isArray(updates) ? updates : []) {
                        if (!update?.pluginId) {
                            continue;
                        }
                        nextUpdates[update.pluginId] = update;
                    }

                    this.pluginUpdates = nextUpdates;
                    this.lastPluginUpdateCheckAt = new Date().toISOString();
                    await PluginStorage.setPluginUpdateRecords(this.pluginUpdates, this.lastPluginUpdateCheckAt);

                    if (!silent) {
                        const updateCount = Object.keys(nextUpdates).length;
                        if (updateCount > 0) {
                            toast.info(`${updateCount} plugin update${updateCount === 1 ? "" : "s"} available`);
                        } else {
                            toast.success("All installed plugins are up to date");
                        }
                    }

                    return this.pluginUpdates;
                } catch (error) {
                    console.error("Failed to check for plugin updates", error);
                    if (!silent) {
                        toast.error("Failed to check for plugin updates");
                    }
                    return this.pluginUpdates;
                } finally {
                    this.checkingForPluginUpdates = false;
                    refreshPluginUpdatesPromise = null;
                }
            })();

            return refreshPluginUpdatesPromise;
        },
        markPluginStarting(pluginId: string, timeoutMs = PLUGIN_STARTING_TIMEOUT_MS) {
            if (!pluginId) {
                return;
            }

            const existing = startingPluginTimeouts.get(pluginId);
            if (existing) {
                clearTimeout(existing);
            }

            const next = new Set(this.startingPlugins);
            next.add(pluginId);
            this.startingPlugins = next;

            const timeout = setTimeout(() => {
                this.clearPluginStarting(pluginId);
            }, timeoutMs);
            startingPluginTimeouts.set(pluginId, timeout);
        },
        clearPluginStarting(pluginId: string) {
            const pending = startingPluginTimeouts.get(pluginId);
            if (pending) {
                clearTimeout(pending);
                startingPluginTimeouts.delete(pluginId);
            }

            if (!this.startingPlugins.has(pluginId)) {
                return;
            }

            const next = new Set(this.startingPlugins);
            next.delete(pluginId);
            this.startingPlugins = next;
        },
        markEnabledPluginsStarting(timeoutMs = PLUGIN_STARTING_TIMEOUT_MS) {
            for (const pluginId of Array.from(this.enabledPlugins || [])) {
                if (!this.activePlugins.has(pluginId)) {
                    this.markPluginStarting(pluginId, timeoutMs);
                }
            }
        },
        rememberLifecycleFailureToast(pluginId: string) {
            lifecycleFailureNotifiedAt.set(pluginId, Date.now());
        },
        wasLifecycleFailureToastRecent(pluginId: string, windowMs = 2000) {
            const notifiedAt = lifecycleFailureNotifiedAt.get(pluginId);
            return Boolean(notifiedAt && Date.now() - notifiedAt < windowMs);
        },
        handlePluginLifecycle(event: PluginLifecycleEvent) {
            if (!event?.id || !event?.status) {
                return;
            }

            const pluginId = event.id;
            const pluginName = event.name || this.connectedPlugins?.[pluginId]?.name || pluginId;

            if (event.status === "starting") {
                this.cancelPendingUnexpectedDisconnect(pluginId);
                this.markPluginStarting(pluginId, 30000);
                return;
            }

            if (event.status === "connected") {
                this.upsertConnectedPlugin({
                    id: pluginId,
                    name: event.name || pluginId,
                    version: event.version,
                    connected_at: event.connected_at,
                    sdkVersion: event.sdkVersion,
                    hostApiVersion: event.hostApiVersion,
                    capabilities: event.capabilities,
                });
                return;
            }

            this.clearPluginStarting(pluginId);

            if (event.status === "stopped") {
                this.removeConnectedPlugin(pluginId);
                return;
            }

            if (event.status === "start_failed") {
                this.removeConnectedPlugin(pluginId);
                this.rememberLifecycleFailureToast(pluginId);
                toast.error(`Failed to start ${pluginName}`, {
                    description: normalizeErrorMessage(event.error) || "The plugin process could not be started.",
                });
                return;
            }

            if (event.status === "exited") {
                this.removeConnectedPlugin(pluginId);
                if (event.expected || expectedPluginDisconnects.has(pluginId)) {
                    this.clearExpectedDisconnect(pluginId);
                    return;
                }

                this.cancelPendingUnexpectedDisconnect(pluginId);
                this.rememberLifecycleFailureToast(pluginId);
                const exitDetail = event.exitCode != null
                    ? `Exited with code ${event.exitCode}.`
                    : event.signal
                        ? `Exited from signal ${event.signal}.`
                        : null;
                toast.error(`${pluginName} crashed`, {
                    description: normalizeErrorMessage(event.error) || exitDetail || "The plugin process exited unexpectedly.",
                });
            }
        },
        cancelPendingUnexpectedDisconnect(pluginId: string) {
            const pending = pendingUnexpectedDisconnects.get(pluginId);
            if (!pending) {
                return;
            }

            clearTimeout(pending);
            pendingUnexpectedDisconnects.delete(pluginId);
        },
        markExpectedDisconnect(pluginId: string, timeoutMs = 5000) {
            if (!pluginId) {
                return;
            }

            const existing = expectedPluginDisconnects.get(pluginId);
            if (existing) {
                clearTimeout(existing);
            }

            const timeout = setTimeout(() => {
                expectedPluginDisconnects.delete(pluginId);
            }, timeoutMs);
            expectedPluginDisconnects.set(pluginId, timeout);
        },
        clearExpectedDisconnect(pluginId: string) {
            const pending = expectedPluginDisconnects.get(pluginId);
            if (!pending) {
                return;
            }

            clearTimeout(pending);
            expectedPluginDisconnects.delete(pluginId);
        },
        async stopPluginIntentionally(pluginId: string) {
            if (!pluginId) {
                return;
            }

            this.cancelPendingUnexpectedDisconnect(pluginId);
            this.markExpectedDisconnect(pluginId);
            await invoke("stop_plugin", { pluginId });
        },
        async restartPluginIntentionally(pluginId: string) {
            if (!pluginId) {
                return;
            }

            this.cancelPendingUnexpectedDisconnect(pluginId);
            this.markExpectedDisconnect(pluginId);
            try {
                await invoke("restart_plugin", { pluginId });
            } catch (error) {
                this.clearExpectedDisconnect(pluginId);
                this.clearPluginStarting(pluginId);
                throw error;
            }
        },
        async installMarketplacePlugin(pluginId: string, registryUrl: string) {
            if (!pluginId) {
                return;
            }

            const expectsDisconnect = this.activePlugins.has(pluginId) || Boolean(this.connectedPlugins[pluginId]);
            if (expectsDisconnect) {
                this.cancelPendingUnexpectedDisconnect(pluginId);
                this.markExpectedDisconnect(pluginId, 15000);
            }

            try {
                await invoke("install_marketplace_plugin", { pluginId, registryUrl });
            } catch (error) {
                if (expectsDisconnect) {
                    this.clearExpectedDisconnect(pluginId);
                }
                throw error;
            }
        },
        async uninstallPluginId(pluginId: string) {
            if (!pluginId) {
                return;
            }

            try {
                await this.stopPluginIntentionally(pluginId);
            } catch (error) {
                console.error(`Failed to stop plugin ${pluginId} before uninstall:`, error);
            }

            try {
                await invoke("uninstall_marketplace_plugin", { pluginId });
            } catch (error) {
                this.clearExpectedDisconnect(pluginId);
                throw error;
            }
        },
        async getLatestPluginFailureReason(pluginId: string) {
            try {
                const rawLogs = await invoke<string>("get_plugin_logs", { pluginId });
                return extractPluginFailureReason(rawLogs);
            } catch (error) {
                console.error(`Failed to read logs for plugin ${pluginId}:`, error);
                return null;
            }
        },
        async refreshConnectedPluginsFromBackend() {
            try {
                const plugins = await invoke<PluginConnectionInfo[]>("get_connected_plugins");
                if (!Array.isArray(plugins)) {
                    return [];
                }

                this.setConnectedPlugins(plugins);
                return plugins;
            } catch (error) {
                console.error("Failed to refresh connected plugins:", error);
                return [];
            }
        },
        scheduleUnexpectedDisconnectToast(plugin: { id: string; name?: string; error?: string | null }) {
            if (!plugin?.id) {
                return;
            }
            if (this.wasLifecycleFailureToastRecent(plugin.id)) {
                return;
            }

            this.cancelPendingUnexpectedDisconnect(plugin.id);
            const pluginId = plugin.id;
            const pluginName = plugin.name || this.connectedPlugins?.[pluginId]?.name || pluginId;
            const eventError = normalizeErrorMessage(plugin.error);

            const timeout = setTimeout(async () => {
                pendingUnexpectedDisconnects.delete(pluginId);

                if (!this.enabledPlugins.has(pluginId) || this.activePlugins.has(pluginId)) {
                    return;
                }

                const reason = eventError || await this.getLatestPluginFailureReason(pluginId);
                toast.error(`${pluginName} crashed`, {
                    description: reason || "The plugin disconnected unexpectedly. Check plugin logs for details.",
                });
            }, UNEXPECTED_PLUGIN_DISCONNECT_GRACE_MS);

            pendingUnexpectedDisconnects.set(pluginId, timeout);
        },
        handlePluginDisconnected(plugin: { id: string; name?: string; error?: string | null }) {
            if (!plugin?.id) {
                return;
            }

            if (expectedPluginDisconnects.has(plugin.id)) {
                this.clearExpectedDisconnect(plugin.id);
                this.removeConnectedPlugin(plugin.id);
                return;
            }

            this.scheduleUnexpectedDisconnectToast(plugin);
            this.removeConnectedPlugin(plugin.id);
        },
        async rollbackEnabledPlugin(pluginId: string) {
            if (!this.enabledPlugins.has(pluginId)) {
                return;
            }

            this.clearPluginStarting(pluginId);
            const next = new Set(this.enabledPlugins);
            next.delete(pluginId);
            this.enabledPlugins = next;
            await PluginStorage.setEnabledPluginIds(Array.from(this.enabledPlugins));
        },
        async waitForPluginActive(pluginId: string, timeoutMs = 10000) {
            const startedAt = Date.now();

            while (Date.now() - startedAt < timeoutMs) {
                if (this.activePlugins.has(pluginId)) {
                    return true;
                }

                const connectedPlugins = await this.refreshConnectedPluginsFromBackend();
                if (connectedPlugins.some((plugin) => plugin?.id === pluginId)) {
                    return true;
                }

                await new Promise((resolve) => setTimeout(resolve, 250));
            }

            if (this.activePlugins.has(pluginId)) {
                return true;
            }

            const connectedPlugins = await this.refreshConnectedPluginsFromBackend();
            return connectedPlugins.some((plugin) => plugin?.id === pluginId);
        },
        setActivePlugins(plugins: string[]) {
            this.activePlugins = new Set(plugins);
            for (const pluginId of plugins) {
                this.clearPluginStarting(pluginId);
            }
        },
        setConnectedPlugins(plugins: PluginConnectionInfo[]) {
            const nextConnectedPlugins: PluginStoreState["connectedPlugins"] = {};
            for (const plugin of plugins) {
                if (!plugin?.id) continue;
                nextConnectedPlugins[plugin.id] = plugin;
            }
            this.connectedPlugins = nextConnectedPlugins;
            this.activePlugins = new Set(Object.keys(nextConnectedPlugins));
            for (const pluginId of Object.keys(nextConnectedPlugins)) {
                this.clearPluginStarting(pluginId);
            }
        },
        addActivePlugin(plugin: string) {
            const next = new Set(this.activePlugins);
            next.add(plugin);
            this.activePlugins = next;
            this.clearPluginStarting(plugin);
        },
        removeActivePlugin(plugin: string) {
            const next = new Set(this.activePlugins);
            next.delete(plugin);
            this.activePlugins = next;
        },
        getActivePlugins() {
            return Array.from(this.activePlugins);
        },
        upsertConnectedPlugin(plugin: PluginConnectionInfo) {
            if (!plugin?.id) return;
            this.cancelPendingUnexpectedDisconnect(plugin.id);
            this.clearExpectedDisconnect(plugin.id);
            this.clearPluginStarting(plugin.id);
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
        isPluginApproved(target: PluginApprovalTarget) {
            const approvalKey = getPluginApprovalKey(createPluginApprovalRecord(target));
            return approvalKey ? this.approvedPlugins.has(approvalKey) : false;
        },
        async approvePlugin(target: PluginApprovalTarget) {
            const approvalRecord = await PluginStorage.approvePlugin(target);
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
            await PluginStorage.setEnabledPluginIds(plugins);
        },
        async enablePluginId(pluginId: string) {
            if (!this.enabledPlugins.has(pluginId)) {
                const next = new Set(this.enabledPlugins);
                next.add(pluginId);
                this.enabledPlugins = next;
                await PluginStorage.setEnabledPluginIds(Array.from(this.enabledPlugins));

                try {
                    await this.stopPluginIntentionally(pluginId);
                } catch (error) {
                    console.error(`Failed to stop plugin ${pluginId} before restart:`, error);
                }

                try {
                    await invoke("start_plugin", { pluginId });
                } catch (error) {
                    this.clearPluginStarting(pluginId);
                    await this.rollbackEnabledPlugin(pluginId);
                    console.error(`Failed to start plugin ${pluginId}:`, error);
                    if (!this.wasLifecycleFailureToastRecent(pluginId)) {
                        toast.error(`Failed to start plugin ${pluginId}: ${normalizeErrorMessage(error) || "Unknown error"}`);
                    }
                    return false;
                }

                const connected = await this.waitForPluginActive(pluginId);
                if (!connected) {
                    this.clearPluginStarting(pluginId);
                    await this.rollbackEnabledPlugin(pluginId);
                    try {
                        await invoke("stop_plugin", { pluginId });
                    } catch (error) {
                        console.error(`Failed to clean up plugin ${pluginId} after startup timeout:`, error);
                    }
                    const reason = await this.getLatestPluginFailureReason(pluginId);
                    if (!this.wasLifecycleFailureToastRecent(pluginId)) {
                        toast.error(
                            reason
                                ? `Plugin ${pluginId} failed to start: ${reason}`
                                : `Plugin ${pluginId} did not connect after startup. Check plugin logs for details.`,
                        );
                    }
                    return false;
                }
            }
            return true;
        },
        async disablePluginId(pluginId: string) {
            if (this.enabledPlugins.has(pluginId)) {
                this.clearPluginStarting(pluginId);
                const next = new Set(this.enabledPlugins);
                next.delete(pluginId);
                this.enabledPlugins = next;
                await PluginStorage.setEnabledPluginIds(Array.from(this.enabledPlugins));

                try {
                    await this.stopPluginIntentionally(pluginId);
                } catch (error) {
                    console.error(`Failed to stop plugin ${pluginId}:`, error);
                }
            }
        },
        isPluginEnabled(pluginId: string) {
            return this.enabledPlugins.has(pluginId);
        },
    },
});
