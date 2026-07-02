<template>
    <div class="flex flex-col justify-start items-center h-full w-full overflow-y-auto">
        <StatsPanel v-if="statsModalOpen" :device="currentDevice" :modal-open="statsModalOpen" @close="statsToggled" />
        <!-- Device Selection -->
        <div data-setting="Device" class="flex flex-row w-full justify-between px-2">
            <span class="shrink-0 pt-1">Device: </span>
            <select @change="deviceSelected" v-model="currentDevice"
                class="select select-bordered select-sm w-2/3 mx-2 capitalize truncate">
                <option class="w-full" v-for="(device, index) in devices" :value="device" :key="index">
                    {{ deviceName(device) }}
                </option>
                <option v-if="connectionState || currentDevice" class="w-full" value="disconnect">
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
                <div data-setting="RGB Effect" class="flex flex-row w-full justify-between mt-4">
                    <span class="shrink-0 pt-1">RGB Effect: </span>
                    <select @change="rgbEffectChangeHandler" :value="currentRGBEffect"
                        class="select select-bordered select-sm w-2/3 mx-2 capitalize truncate">
                        <option class="w-full" v-for="(effect, index) in RGBEffects" :value="effect" :key="index">
                            {{ effect }}
                        </option>
                    </select>
                </div>
                <div v-if="currentRGBEffect === 'Static'" class="flex flex-col w-full mt-2">
                    <div data-setting="Static color" class="mb-4 flex justify-between items-center w-full">
                        <span class="shrink-0">Choose static color: </span>
                        <input @input="colorChange" type="color" class="colorpicker bg-base-300 rounded-xl px-0.5" :value="selectedColor" />
                    </div>
                    <div data-setting="Breathing effect" class="flex justify-between items-center w-full">
                        <span class="shrink-0">Breathing effect: </span>
                        <input @change="toggleBreathing" type="checkbox" class="toggle toggle-primary" :checked="breathingEnabled"/>
                    </div>
                </div>
                <div data-setting="RGB Speed" v-if="(currentRGBEffect === 'Static' && breathingEnabled) || (currentRGBEffect !== 'Off' && currentRGBEffect !== 'Lightning Storm' && currentRGBEffect !== 'Static')" class="flex flex-row w-full justify-between mt-2">
                    <span class="shrink-0 pt-1">Speed: </span>
                    <input @change="speedChanged" v-model="speed" type="range" class="range range-xs range-primary w-1/2 m-auto rounded-xl px-0.5 mr-2" />
                </div>
                <div data-setting="Brightness" class="flex flex-row w-full justify-between mt-2">
                    <span class="shrink-0 pt-1">Brightness: </span>
                    <input @change="brightnessChanged" v-model="brightness" type="range" class="range range-xs range-primary w-1/2 m-auto rounded-xl px-0.5 mr-2 " />
                </div>
                <div data-setting="Turn off LEDs on Sleep" class="flex justify-between items-center w-full mt-2">
                    <div class="flex flex-col">
                        <span class="shrink-0 pt-1">Turn off LEDs on Sleep</span>
                        <span class="text-xs opacity-50 pr-4">
                            Automatically switch off Decker LEDs when the computer enters sleep mode.
                        </span>
                    </div>
                    <input @change="suspendDimToggled" type="checkbox" class="toggle toggle-primary px-0.5 mr-2" :checked="suspendDimEnabled"/>
                </div>
            </div>

            <div data-setting="Device Info" class="flex flex-col w-full items-center mt-3">
                <span class="shrink-0 pt-1 font-bold">Device Info: </span>
                <div class="divider mt-0"></div>
                <div :key="infopoint" v-for="(infopoint, index) in deviceInfoPoints" class="flex text-sm flex-row w-full justify-between my-1">
                    <span class="label-text my-auto">{{infopoint.name}}:</span>
                    <span :key="currentDevice" class="font-semibold w-1/3 text-left">{{deviceInfo(currentDevice)?.[index] ?? 'N/A'}}</span>
                </div>
                <div class=" flex flex-row w-full justify-between my-1">
                    <span class="label-text my-auto">Stats</span>
                    <button @click="statsToggled" class="font-semibold btn btn-sm w-1/3">See</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { toast } from "vue-sonner";
import Decker from "../ts/decker.ts";
import ConfigStore from "../ts/config.ts";
import StatsPanel from "./StatsPanel.vue";
import RGBController from "../ts/RGBController";
import { mapState } from "pinia";
import { useDeckerStore } from "../store/deckerStore.ts";
import EventBus from "../js/eventBus";

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
                deviceName: { name: "Device Name", value: "Decker" },
                model: { name: "Model", value: "VM-5SW" },
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
            brightness: 100,
            suspendDimEnabled: false,
            deviceNames: {
                'VM-5SW': "Decker",
            },
            deviceData: {},
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
            device = {...device, ...this.deviceData};
            if(!device) return;


            if(device.pid === 58918 && device.vid === 1240){
                return {
                    model: device?.deviceModel ?? "Unknown",
                    deviceName: this.deviceNames[device.deviceModel] ?? "Unknown",
                    firmwareVersion: device?.firmwareVersion,
                    serialNumber: device?.serialNumber,
                    comPort: device?.port_name,
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
            const brightness = parseInt(this.brightness * 2.55);
            ConfigStore.set("RGBSpeed", this.speed);
            ConfigStore.save();
            if(this.currentRGBEffect === 'Static' && this.breathingEnabled) {
                return RGBController.setEffect('breathing', parseInt(100 - this.speed), brightness, this.selectedColor);
            }
            RGBController.setEffect(this.currentRGBEffect.toLowerCase(), parseInt(100 - this.speed), brightness, this.selectedColor);
        },

        brightnessChanged(event) {
            ConfigStore.set("RGBBrightness", this.brightness);
            ConfigStore.save();
            this.sendCurrentRGBEffect();
        },

        deviceName(device){
            if(!device) return;
            if(device.pid === 58918 && device.vid === 1240){
                return `Decker (${device.port_name})`;
            } else {
                return `${device.port_name}`;
            }
        },

        toggleBreathing(event) {
            const brightness = parseInt(this.brightness * 2.55);
            this.breathingEnabled = event.target.checked;
            ConfigStore.set("RGBBreathing", this.breathingEnabled);
            ConfigStore.save();
            if(this.breathingEnabled) {
                RGBController.setEffect('breathing', parseInt(100 - this.speed), brightness, this.selectedColor);
                return;
            }
            RGBController.setEffect('static', 0, brightness, this.selectedColor);
        },

        sendCurrentRGBEffect() {
            const brightness = parseInt(this.brightness * 2.55);
            if(this.currentRGBEffect === "Static" && this.breathingEnabled) {
                RGBController.setEffect('static', 0, brightness, this.selectedColor);
                return RGBController.setEffect('breathing', parseInt(100 - this.speed), brightness, this.selectedColor);
            }

            if(this.currentRGBEffect === "Lightning Storm") return RGBController.setEffect('lightningStorm', 10, brightness, '#fffff');
            RGBController.setEffect(this.currentRGBEffect.toLowerCase(), parseInt(100 - this.speed), brightness, this.selectedColor);
        },

        rgbEffectChangeHandler(event){
            ConfigStore.set("RGBEffect", event.target.value);
            ConfigStore.save();
            this.rgbEffectChange(event);
        },

        rgbEffectChange(event) {
            const brightness = parseInt(this.brightness * 2.55);
            this.currentRGBEffect = event.target.value;
            if(this.currentRGBEffect === 'Off') {
                RGBController.setEffect('off', 0, brightness, '#000000');
                return;
            } else if (this.currentRGBEffect === 'Static') {
                RGBController.setEffect('static', 0, brightness, this.selectedColor);
                if(this.breathingEnabled) return RGBController.setEffect('breathing', parseInt(100 - this.speed), brightness, this.selectedColor);
            } else if (this.currentRGBEffect === 'Rainbow') {
                RGBController.setEffect('rainbow', parseInt(100 - this.speed), brightness, '#fffff');
            } else if (this.currentRGBEffect === 'Candle') {
                RGBController.setEffect('candle', parseInt(100 - this.speed), brightness, '#fffff');
            } else if (this.currentRGBEffect === 'Lightning Storm') {
                RGBController.setEffect('lightningStorm', 10, brightness, '#fffff');
            } else if (this.currentRGBEffect === 'Perimeter') {
                RGBController.setEffect('perimeter', (100 - this.speed), brightness, '#fffff');
            } 
        },

        colorChange(event) {
            const brightness = parseInt(this.brightness * 2.55);
            const currentTime = Date.now();

            if (currentTime - this.lastExecutionTime >= 100) {
                this.selectedColor = event.target.value;

                this.lastExecutionTime = currentTime;

                RGBController.setEffect('static', 0, brightness, this.selectedColor);
                if(this.breathingEnabled) return RGBController.setEffect('breathing', parseInt(100 - this.speed), brightness, this.selectedColor);
                ConfigStore.set("RGBColor", this.selectedColor);
                ConfigStore.save();
            }
        },

        suspendDimToggled(event) {
            this.suspendDimEnabled = event.target.checked;
            ConfigStore.set("suspendDimEnabled", this.suspendDimEnabled);
            ConfigStore.save();
        },


        async deviceSelected() {
            if(this.currentDevice === "disconnect") {
                Decker.disconnect();
                this.currentDevice = null;
                ConfigStore.set("comPort", null);
                ConfigStore.save();
                return;
            }
            if(this.currentDevice.pid === 58918 && this.currentDevice.vid === 1240){
                this.deviceType = "Decker";
            } else {
                this.deviceType = "Unknown";
            }
            ConfigStore.set("comPort", this.currentDevice.port_name);
            ConfigStore.save();
            try {
                await Decker.init(this.currentDevice.port_name);
            } catch (error) {
                const msg = String(error);
                if (msg.includes('Permission denied') || msg.includes('Access is denied')) {
                    toast.error(`Permission denied on ${this.currentDevice.port_name}. Try replugging the device. If that doesn't help, run: sudo sh -c 'echo SUBSYSTEM==\"tty\", KERNEL==\"ttyACM[0-9]*\", TAG+=\"uaccess\" > /etc/udev/rules.d/99-dot-x.rules && udevadm control --reload-rules && udevadm trigger'`, { duration: 12000 });
                } else {
                    toast.error(`Failed to connect to device: ${msg}`);
                }
            }
        },


        getDevices() {
            Decker.getDevices().then((devices) => {
                this.devices = devices;
                this.getConnectedDevice();
            });
        },


        async getConnectedDevice() {
            //check if device stored exists in devices list
            const storedDevice = await ConfigStore.get("comPort");
            if(!storedDevice) return;
            const device = this.devices.find((device) => device.port_name === storedDevice);
            if(!device) return;
            if(device.pid === 58918 && device.vid === 1240){
                this.deviceType = "Decker";
            } else {
                this.deviceType = "Unknown";
            }
            this.currentDevice = device;
        },
        
        async getDeviceInfo(){
            if(this.deviceType === 'Unknown') return;
            try {
                this.deviceData = await Decker.getDeviceInfo();
            } catch (error) {
                console.error("Failed to get device info:", error);
                // Optionally display a user-friendly message or handle the error accordingly
            }
        },

    },


    async mounted() {
        this.getDevices();
        this.selectedColor = await ConfigStore.get("RGBColor") ?? "#f0f0f0";
        this.speed = await ConfigStore.get("RGBSpeed") ?? 10;
        this.currentRGBEffect = await ConfigStore.get("RGBEffect") ?? "Static";
        this.breathingEnabled = await ConfigStore.get("RGBBreathing") ?? false;
        this.brightness = await ConfigStore.get("RGBBrightness") ?? 100;
        this.suspendDimEnabled = await ConfigStore.get("suspendDimEnabled") ?? false;

        this.comPortInterval = setInterval(() => {
            if(this.connectionState && !this.modalOpen) return;
            this.getDevices();
        }, 1000);

        EventBus.on('connectionChange', async dataObject => {
            const { connected } = dataObject;
            if(connected) {
                this.sendCurrentRGBEffect();
                this.getDeviceInfo();
                return;
            }
        });

        if(this.connectionState) {
            this.sendCurrentRGBEffect(); // Dot X was just opened and device is connected, send current RGB effect
            this.getDeviceInfo();
        }
    },

    beforeUnmount() {
        if (this.comPortInterval) {
            clearInterval(this.comPortInterval);
            this.comPortInterval = null;
        }
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