<template>
    <div class="flex flex-col justify-between items-center h-full w-full overflow-y-auto">
        <StatsPanel v-if="statsModalOpen" :device="currentDevice" :modal-open="statsModalOpen" @close="statsToggled" />
        <!-- Device Selection -->
        <div class="flex flex-row w-full justify-between px-2">
            <span class="shrink-0 pt-1">Device: </span>
            <select @change="deviceSelected" v-model="currentDevice"
                class="select select-bordered select-sm w-2/3 mx-2 capitalize truncate">
                <option class="w-full" v-for="(device, index) in devices" :value="device" :key="index">
                    {{ deviceName(device) }}
                </option>
            </select>
            <!-- <button @click="detectBoard" title="Autodiscover" class="btn btn-circle btn-sm">
                <i class="fa-solid fa-magnifying-glass"></i>
            </button> -->
        </div>

        <div :class="deviceConnected ? '' : 'opacity-40 pointer-events-none'" class="w-full h-full rounded-lg px-2 ">
            <!-- RGB Control -->
            <div class="flex flex-row w-full justify-between mt-4">
                <span class="shrink-0 pt-1">RGB Effect: </span>
                <select @change="rgbEffectChange" :value="currentRGBEffect"
                    class="select select-bordered select-sm w-2/3 mx-2 capitalize truncate">
                    <option class="w-full" v-for="(effect, index) in RGBEffects" :value="effect" :key="index">
                        {{ effect }}
                    </option>
                </select>
            </div>
            <div v-if="currentRGBEffect === 'Static'" class="flex flex-row w-full justify-between mt-2">
                <span class="shrink-0 pt-1">Choose static color: </span>
                <input type="color" class="colorpicker bg-gray-700 rounded-xl px-0.5 mr-2" value="#e66465" />
            </div>
            <div v-else-if="currentRGBEffect !== 'Off'" class="flex flex-row w-full justify-between mt-2">
                <span class="shrink-0 pt-1">Speed: </span>
                <input type="range" class="bg-gray-700 rounded-xl px-0.5 mr-2" value="#e66465" />
            </div>
            <!-- Device Info - TODO: Set to disabled if not connected -->
            <div class="flex flex-col w-full items-center mt-3">
                <span class="shrink-0 pt-1 font-bold">Device Info: </span>
                <div class="divider mt-0"></div>
                <div :key="infopoint" v-for="(infopoint, index) in deviceInfoPoints" class="flex flex-row w-2/3 justify-between my-1">
                    <span class="text-gray-500">{{infopoint.name}}:</span>
                    <span class="font-semibold w-1/3 text-center">{{deviceInfo(currentDevice)?.[index] ?? 'N/A'}}</span>
                </div>
                <div class=" flex flex-row w-2/3 justify-between my-1">
                    <span class="text-gray-500">Stats</span>
                    <button @click="statsToggled" class="font-semibold btn btn-sm w-1/3">See</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { useToast } from "vue-toastification";
import Decker from "../ts/decker.ts";
import ConfigStore from "../ts/config.ts";
import StatsPanel from "./StatsPanel.vue";

const toast = useToast();


export default {
    name: "Devices",


    components: {
        StatsPanel,
    },

    data() {
        return {
            devices: [],
            currentDevice: null,
            comPortInterval: null,
            deviceInfoPoints: {
                model: { name: "Model", value: "Decker 1.0" },
                firmwareVersion: { name: "Firmware", value: "1.0.0" },
                serialNumber: { name: "Serial Number", value: "123456789" },
                comPort: { name: "COM Port", value: "COM 2" }
            },
            currentRGBEffect: "Static", 
            RGBEffects: ["Off","Static", "Rainbow", "Candle", "Fire"],
            deviceConnected: true,
            statsModalOpen: false,
        }
    },


    methods: {

        statsToggled() {
            this.statsModalOpen = !this.statsModalOpen;
        },

        deviceInfo(device) {
            if(!device) return;
            if(device.pid === 58918 && device.vid === 1240){
                return {
                    model: "Decker 1.0",
                    firmwareVersion: "1.0.0",
                    serialNumber: device.serial_number,
                    comPort: device.port_name,
                }
            } else {
                return {
                    model: device.manufacturer,
                    firmwareVersion: "N/A",
                    serialNumber: "N/A",
                    comPort: device.port_name,
                }
            }
        },

        deviceName(device){
            if(!device) return;
            if(device.pid === 58918 && device.vid === 1240){
                return `Decker - SN${device.serial_number}`;
            } else {
                return `${device.manufacturer} - ${device.port_name}`;
            }
        },
        rgbEffectChange(event) {
            this.currentRGBEffect = event.target.value;           
        },

        // getSavedComPort() {
        //     this.currentComPort = store.get("config.comPort");
        //     console.log(this.currentComPort);
        // },

        deviceSelected() {
            ConfigStore.set("comPort", this.currentDevice.port_name);
            ConfigStore.save();
            Decker.init(this.currentDevice.port_name);
        },


        getDevices() {
            Decker.getDevices().then((devices) => {
                this.devices = devices;
                console.log(devices);
                this.getConnectedDevice();
            });
        },


        async getConnectedDevice() {
            //check if device stored exists in devices list
            const storedDevice = await ConfigStore.get("comPort");
            if(!storedDevice) return;
            const device = this.devices.find((device) => device.port_name === storedDevice);
            if(!device) return;
            this.currentDevice = device;
        },
        

    },
    mounted() {
        this.getDevices();

        //TODO: Add autodiscover - but only if no device is connected
        // this.comPortInterval = setInterval(() => {
        //     this.getComPorts();
        // }, 1000);
    },
}
</script>

<style scoped>
.colorpicker {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  border: none;
  cursor: pointer;
  margin-right: 5px;
  box-shadow: 2cap;
}
.colorpicker::-webkit-color-swatch {
  border-radius: 15px;
  border: none;
}
.colorpicker::-moz-color-swatch {
  border-radius: 15px;
  border: none;
}

</style>