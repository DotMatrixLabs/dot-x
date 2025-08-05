import { defineStore } from "pinia";

export const useStore = defineStore('store', {
    state: () => ({
        activePlugins: [] as any[],
    }),
    getters: {
        getActivePlugins: (state) => state.activePlugins,
    },
    actions: {
        setActivePlugins(plugins: any) {
            this.activePlugins = plugins;
        },
        addActivePlugin(plugin: any) {
            this.activePlugins.push(plugin);
        },
        removeActivePlugin(plugin: any) {
            this.activePlugins = this.activePlugins.filter((p) => p !== plugin);
        },
        getActivePlugins() {
            return this.activePlugins;
        }
    }
})