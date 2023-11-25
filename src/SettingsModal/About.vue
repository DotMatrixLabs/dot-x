<template>
    <div class="flex flex-col justify-between items-center w-full">
        <div class="flex flex-row w-full justify-between px-2 mt-4">
            <span class="my-auto">Version Number: </span>
            <span class="my-auto">{{appVersion}}</span>
        </div>
    </div>
</template>

<script>

import tauriConf from "../../src-tauri/tauri.conf.json";


export default {
    name: "About",
    data() {
        return {
            appVersion: tauriConf.package.version,
        }
    },
    methods: {

    },
    mounted() {

    },
}
</script>

<style lang="scss" scoped></style>