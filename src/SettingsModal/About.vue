<template>
    <div>
        <p class="pb-4">
            <span class="font-bold">Version: </span>{{ appVersion }}
        </p>
    </div>
</template>

<script>

import { version } from "../../package.json";


export default {
    name: "About",
    data() {
        return {
            appVersion: version,
        }
    },
    methods: {

    },
    mounted() {

    },
}
</script>

<style lang="scss" scoped></style>