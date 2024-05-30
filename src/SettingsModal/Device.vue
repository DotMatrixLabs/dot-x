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
                <option v-if="connectionState" class="w-full" value="disconnect">
                    Disconnect
                </option>
            </select>
            <!-- <button @click="detectBoard" title="Autodiscover" class="btn btn-circle btn-sm">
                <i class="fa-solid fa-magnifying-glass"></i>
            </button> -->
        </div>

        <div v-if="deviceType === 'Decker'" :class="connectionState ? '' : 'opacity-40 pointer-events-none'" class="w-full h-full rounded-lg px-2 ">
            <!-- RGB Control -->
            <div>
                <div class="flex flex-row w-full justify-between mt-4">
                    <span class="shrink-0 pt-1">RGB Effect: </span>
                    <select @change="rgbEffectChangeHandler" :value="currentRGBEffect"
                        class="select select-bordered select-sm w-2/3 mx-2 capitalize truncate">
                        <option class="w-full" v-for="(effect, index) in RGBEffects" :value="effect" :key="index">
                            {{ effect }}
                        </option>
                    </select>
                </div>
                <div v-if="currentRGBEffect === 'Static'" class="flex flex-col w-full mt-2">
                    <div class="mb-4 flex justify-between items-center w-full">
                        <span class="shrink-0">Choose static color: </span>
                        <input @input="colorChange" type="color" class="colorpicker bg-gray-700 rounded-xl px-0.5" :value="selectedColor" />
                    </div>
                    <div class="flex justify-between items-center w-full">
                        <span class="shrink-0">Breathing effect: </span>
                        <input @change="toggleBreathing" type="checkbox" class="toggle toggle-primary" :checked="breathingEnabled"/>
                    </div>
                </div>
                <div v-if="(currentRGBEffect === 'Static' && breathingEnabled) || (currentRGBEffect !== 'Off' && currentRGBEffect !== 'Lightning Storm' && currentRGBEffect !== 'Static')" class="flex flex-row w-full justify-between mt-2">
                    <span class="shrink-0 pt-1">Speed: </span>
                    <input @change="speedChanged" v-model="speed" type="range" class="bg-gray-700 rounded-xl px-0.5 mr-2" />
                </div>
            </div>
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
import RGBController from "../ts/RGBController";
import { mapState } from "pinia";
import { useDeckerStore } from "../store/deckerStore.ts";
import EventBus from "../js/eventBus";

const toast = useToast();


export default {
    name: "Devices",


    components: {
        StatsPanel,
    },

    props: {
        modalOpen: Boolean,
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
            RGBEffects: ["Off", "Static", "Rainbow", "Candle", "Lightning Storm", "Perimeter"],
            deviceConnected: true,
            statsModalOpen: false,
            lastExecutionTime: 0,
            deviceType: "Unknown",
            speed: 10,
            breathingEnabled: false,
            selectedColor: "#f0f0f0",
        }
    },

    computed: {
        ...mapState(useDeckerStore, {
            connectionState: 'getConnectionState',
        }),
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
                    model: "N/A",
                    firmwareVersion: "N/A",
                    serialNumber: "N/A",
                    comPort: device.port_name,
                }
            }
        },

        speedChanged(event) {
            ConfigStore.set("RGBSpeed", this.speed);
            ConfigStore.save();
            if(this.currentRGBEffect === 'Static' && this.breathingEnabled) {
                return RGBController.setEffect('breathing', parseInt(100 - this.speed), 255, this.selectedColor);
            }
            RGBController.setEffect(this.currentRGBEffect.toLowerCase(), parseInt(100 - this.speed), 255, this.selectedColor);
        },

        deviceName(device){
            if(!device) return;
            if(device.pid === 58918 && device.vid === 1240){
                this.deviceType = "Decker";
                return `Decker - SN${device.serial_number}`;
            } else {
                this.deviceType = "Unknown";
                return `${device.port_name}`;
            }
        },

        toggleBreathing(event) {
            this.breathingEnabled = event.target.checked;
            ConfigStore.set("RGBBreathing", this.breathingEnabled);
            ConfigStore.save();
            if(this.breathingEnabled) {
                RGBController.setEffect('breathing', parseInt(100 - this.speed), 255, this.selectedColor);
                return;
            }
            RGBController.setEffect('static', 0, 255, this.selectedColor);
        },

        sendCurrentRGBEffect() {
            if(this.currentRGBEffect === "Static" && this.breathingEnabled) {
                RGBController.setEffect('static', 0, 255, this.selectedColor);
                return RGBController.setEffect('breathing', parseInt(100 - this.speed), 255, this.selectedColor);
            }

            if(this.currentRGBEffect === "Lightning Storm") return RGBController.setEffect('lightningStorm', 10, 255, '#fffff');
            RGBController.setEffect(this.currentRGBEffect.toLowerCase(), parseInt(100 - this.speed), 255, this.selectedColor);
        },

        rgbEffectChangeHandler(event){
            ConfigStore.set("RGBEffect", event.target.value);
            ConfigStore.save();
            this.rgbEffectChange(event);
        },

        rgbEffectChange(event) {
            this.currentRGBEffect = event.target.value;
            console.log(this.currentRGBEffect);
            if(this.currentRGBEffect === 'Off') {
                RGBController.setEffect('off', 0, 255, '#000000');
                return;
            } else if (this.currentRGBEffect === 'Static') {
                RGBController.setEffect('static', 0, 255, this.selectedColor);
                if(this.breathingEnabled) return RGBController.setEffect('breathing', parseInt(100 - this.speed), 255, this.selectedColor);
            } else if (this.currentRGBEffect === 'Rainbow') {
                RGBController.setEffect('rainbow', parseInt(100 - this.speed), 255, '#fffff');
            } else if (this.currentRGBEffect === 'Candle') {
                RGBController.setEffect('candle', parseInt(100 - this.speed), 255, '#fffff');
            } else if (this.currentRGBEffect === 'Lightning Storm') {
                RGBController.setEffect('lightningStorm', 10, 255, '#fffff');
            } else if (this.currentRGBEffect === 'Perimeter') {
                RGBController.setEffect('perimeter', (100 - this.speed), 255, '#fffff');
            } 
        },

        colorChange(event) {
        const currentTime = Date.now();

        if (currentTime - this.lastExecutionTime >= 100) {
            this.selectedColor = event.target.value;
            
            this.lastExecutionTime = currentTime;

            RGBController.setEffect('static', 0, 255, this.selectedColor);
            if(this.breathingEnabled) return RGBController.setEffect('breathing', parseInt(100 - this.speed), 255, this.selectedColor);
            ConfigStore.set("RGBColor", this.selectedColor);
            ConfigStore.save();
        }
    },

        // getSavedComPort() {
        //     this.currentComPort = store.get("config.comPort");
        //     console.log(this.currentComPort);
        // },

        deviceSelected() {
            if(this.currentDevice === "disconnect") {
                Decker.disconnect();
                this.currentDevice = null;
                ConfigStore.set("comPort", null);
                ConfigStore.save();
                return;
            }
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
    async mounted() {
        this.getDevices();
        this.selectedColor = await ConfigStore.get("RGBColor") ?? "#f0f0f0";
        this.speed = await ConfigStore.get("RGBSpeed") ?? 10;
        this.currentRGBEffect = await ConfigStore.get("RGBEffect") ?? "Static";
        this.breathingEnabled = await ConfigStore.get("RGBBreathing") ?? false;

        this.comPortInterval = setInterval(() => {
            if(this.connectionState && !this.modalOpen) return;
            this.getDevices();
        }, 1000);

        EventBus.on('connectionChange', dataObject => {
            const { connected } = dataObject;
            if(connected) {
                this.sendCurrentRGBEffect();                
                return;
            }
        });

        if(this.connectionState) this.sendCurrentRGBEffect(); // Dot X was just opened and device is connected, send current RGB effect
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