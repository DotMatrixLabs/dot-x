import { defineStore } from "pinia";

export const useStore = defineStore('store', {
    state: () => ({
        activePlugins: new Set<string>(),
    }),
    getters: {
        getActivePlugins: (state) => state.activePlugins,
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
        }
    }
})