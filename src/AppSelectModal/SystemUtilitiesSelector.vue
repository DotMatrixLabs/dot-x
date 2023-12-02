<template>
    <div class="grid grid-cols-3 w-1/2 m-auto">
        <div class="flex flex-col justify-center items-center" v-for="device in devices">
            <button @click="setActiveDevice(device.id)" class="btn btn-circle"
                :class="activeDevices?.includes(device.id) ? 'btn-primary' : ''">
                <i :class="device.icon"></i>
            </button>
            <span class="text-base-content text-xs text-center capitalize my-1"> {{ device.title }}</span>
        </div>
    </div>
</template>

<script>


import SelectedApps from "../ts/appsToControl.ts";


export default {

    props: {
        currentSliderID: Number,
    },

    data() {
        return {
            devices: [
                { title: "master", icon: "fas fa-volume-up fa-lg", id: "master" },
                { title: "microphone", icon: "fas fa-lg fa-microphone", id: "mic" },
                { title: "unmapped", icon: "fas fa-lg fa-question-circle", id: "unmapped"}
            ],
            activeDevices: [],
        }
    },

    methods: {
        async setActiveDevice(device) {
            await SelectedApps.toggleApp(this.currentSliderID.toString(), device);
            this.getActiveDevices();
        },

        async getActiveDevices(){
            if(this.currentSliderID === null) return;
            this.activeDevices = await SelectedApps.getApps(this.currentSliderID?.toString());
        }
    },

    mounted() {
        this.getActiveDevices();
    },

}
</script>

<style lang="scss" scoped></style>