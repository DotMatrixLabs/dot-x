<template>
    <div class="flex flex-col justify-between items-center w-full">
        <div class="flex flex-row w-full justify-between px-2">
            <span class="shrink-0 pt-1">Theme: </span>
            <select @change="setTheme" v-model="currentTheme"
                class="select select-bordered select-sm w-2/3 mx-2 capitalize truncate">
                <option class="w-full" v-for="(theme, index) in themes" :value="theme" :key="index">
                    {{ theme }}
                </option>
            </select>
        </div>
        <!-- <div class="flex flex-row w-full justify-between px-2 mt-4">
            <span class="my-auto">Run in background: </span>
            <input type="checkbox" class="toggle toggle-primary mr-2" checked />
        </div> -->
        <div class="flex flex-row w-full justify-between px-2 mt-4">
            <span class="my-auto">Run on startup: </span>
            <input type="checkbox" class="toggle toggle-primary mr-2" :checked="autoStartStatus" @change="toggleAutostart" />
        </div>
    </div>
</template>

<script>

import ConfigStore from "../ts/config.ts";
import SystemSettings from "../ts/systemSettings.ts";

export default {
    name: "General",
    data() {
        return {
            themes: ["light", "dark"],
            currentTheme: "",
            autoStartStatus: false,
        }
    },
    methods: {
        async getTheme() {
            this.currentTheme = await ConfigStore.get("theme") || "dark";
            document.documentElement.setAttribute("data-theme", this.currentTheme);
            return this.currentTheme;
        },
        async setTheme(event) {
            await ConfigStore.set("theme", event.target.value);
            await ConfigStore.save();
            document.documentElement.setAttribute("data-theme", event.target.value);
        },
        async getAutostartStatus() {
            this.autoStartStatus = await SystemSettings.checkAutostartStatus();
            console.log(await SystemSettings.checkAutostartStatus());
        },
        async toggleAutostart() {
            if(this.autoStartStatus){
                await SystemSettings.disableAutostart();
                this.getAutostartStatus();
                return;
            }
            else await SystemSettings.enableAutostart();
            this.getAutostartStatus();
        }
    },
    mounted() {
        this.getTheme();
        this.getAutostartStatus();
    },
}
</script>

<style lang="scss" scoped></style>