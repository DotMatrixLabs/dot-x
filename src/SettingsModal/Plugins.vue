<template>
    <div class="flex flex-col items-center h-full w-full gap-2">
        <h1 class="font-bold text-lg text-center">Plugins</h1>
        <div class="flex flex-col overflow-y-auto bg-base-200 bg-opacity-50 overflow-x-hidden h-full w-full p-4 rounded-lg relative">
            <div v-if="loading" class="absolute bg-gray-900 h-full w-full left-0 top-0 bg-opacity-50">
                <div class="absolute transform left-1/2 -translate-x-1/2 top-1/2">
                    <LoadingSpinner />
                </div>
            </div>
            <div class="w-full h-full">
                <button v-for="plugin in plugins" :key="plugin" class="hover:bg-base-100 rounded-lg w-full flex flex-row justify-between p-1 border-2 border-base-100"
                    @click="selectSliderApp(item)">
                    <div class="truncate cursor-pointer py-0.5 text-lg w-full text-left mx-2">
                        <span>{{ plugin.name.replace('.wasm', '') }}</span>
                        <span class="text-xs opacity-30 ml-2"> - {{ plugin.name }}</span>
                    </div>
                    <input type="checkbox" class="toggle toggle-md m-auto" checked />
                    <!-- <button class="mt-1" @click="removeClicked(plugin.name)">
                        <i class="fas fa-xmark m-auto w-4 h-4 p-1 rounded-full hover:bg-gray-500 hover:bg-opacity-30"></i>
                    </button> -->
                </button>
            </div>
        </div>
    </div>
</template>

<script>
import LoadingSpinner from "../assets/loadingSpinner.vue";
import PluginManager from "../ts/pluginManager";
import ConfigStore from "../ts/config";

export default {
    name: "Plugins",
    data() {
        return {
            plugins: [],
            loading: false,
        };
    },
    methods: {

        async getActivePlugins() {
           return await ConfigStore.get("activePlugins");
        },

        async getAllPlugins() {
            this.loading = true;
            const activePlugins = await this.getActivePlugins();
            const allPlugins = await PluginManager.getPlugins();
            this.plugins = allPlugins.map((plugin) => {
                return {
                    ...plugin,
                    active: activePlugins?.includes(plugin.name),
                };
            });
            this.loading = false;
            console.log(this.plugins);
        },
    },
    mounted() {
        this.getAllPlugins();
    },
}
</script>

<style lang="scss" scoped></style>