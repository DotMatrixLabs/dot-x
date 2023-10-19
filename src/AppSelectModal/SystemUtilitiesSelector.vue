<template>
    <div class="grid grid-cols-2 w-1/2 m-auto">
        <div class="flex flex-col justify-center items-center" v-for="device in devices">
            <button @click="setActiveDevice(device.id)" class="btn btn-circle"
                :class="activeDevice === device.id ? 'btn-primary' : ''">
                <i :class="device.icon"></i>
            </button>
            <span class="text-white text-xs text-center capitalize my-1"> {{ device.title }}</span>
        </div>
    </div>
</template>

<script>
export default {

    data() {
        return {
            devices: [{ title: "master", icon: "fas fa-volume-up fa-lg", id: "master" },
            { title: "microphone", icon: "fas fa-lg fa-microphone", id: "mic" }
            ],
            activeDevice: null
        }
    },

    methods: {
        setActiveDevice(device) {
            console.log("set active device")
            if (device === this.activeDevice) this.activeDevice = null;
            else if (device !== this.activeDevice) this.activeDevice = device;

        }
    },

}
</script>

<style lang="scss" scoped></style>