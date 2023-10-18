<template>
    <div class="w-full">
        <span>Theme: </span>
        <select @change="setTheme" v-model="currentTheme"
            class="select select-bordered select-sm w-2/3 capitalize focus:border-none">
            <option v-for="(theme, index) in themes" :value="theme" :key="index">
                {{ theme }}
            </option>
        </select>
    </div>
</template>

<script>

import TauriStore from "../ts/storage.ts";

export default {
    name: "General",
    data() {
        return {
            themes: ["light", "dark"],
            currentTheme: "",
        }
    },
    methods: {
        async getTheme() {
            this.currentTheme = await TauriStore.get("config.theme") || "dark";
            document.documentElement.setAttribute("data-theme", this.currentTheme);
            return this.currentTheme;
        },
        async setTheme(event) {
            await TauriStore.set("config.theme", event.target.value);
            await TauriStore.save();
            document.documentElement.setAttribute("data-theme", event.target.value);
        },
    },
    mounted() {
        this.getTheme();
    },
}
</script>

<style lang="scss" scoped></style>