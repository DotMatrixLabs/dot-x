<template>
    <div class="flex flex-col justify-between items-center h-full w-full">
        <!-- Device Selection -->
        <div class="flex flex-row w-full justify-between px-2">
            <span class="shrink-0 pt-1">Device: </span>
            <select @change="comPortSelected" v-model="currentComPort"
                class="select select-bordered select-sm w-2/3 mx-2 capitalize truncate">
                <option class="w-full" v-for="(comPort, index) in comPorts" :value="comPort" :key="index">
                    {{ `${comPort.path} - ${comPort.manufacturer}` }}
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
                    <option class="w-full" v-for="(effect, index) in RGBEffects" :value="comPort" :key="index">
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
            <!-- Device Info -->
            <div class="flex flex-col w-full items-center mt-6">
                <span class="shrink-0 pt-1 font-bold">Device Info: </span>
                <div class="divider mt-0"></div>
                <div :key="deviceInfo" v-for="deviceInfo in deviceInfoPoints" class=" flex flex-row w-2/3 justify-between">
                    <span class="text-gray-500">{{deviceInfo.name}}:</span>
                    <span class="font-semibold">{{deviceInfo.value}}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
// import BoardManager from "../../js/boardManager.js";
// import StorageHandler from "../../js/storage.mjs";
import { useToast } from "vue-toastification";


const toast = useToast();
// const boardManager = new BoardManager();
// const store = new StorageHandler();

export default {
    name: "Connectivity",
    data() {
        return {
            comPorts: [],
            currentComPort: null,
            comPortInterval: null,
            deviceInfoPoints: [
                { name: "Model", value: "Decker 1.0" },
                { name: "Firmware", value: "1.0.0" },
                { name: "Serial Number", value: "123456789" },
                { name: "COM Port", value: "COM 2" }
            ],
            currentRGBEffect: "Static", 
            RGBEffects: ["Off","Static", "Rainbow", "Candle", "Fire"],
            deviceConnected: true,
        }
    },
    methods: {
        rgbEffectChange(event) {
            this.currentRGBEffect = event.target.value;           
        },
        // detectBoard() {
        //     boardManager.autodiscover().then((boards) => {
        //         if (boards.length === 0)
        //             return toast.warning("Unable to find any boards..");
        //         this.currentComPort = boards[0];
        //         console.log(boards);
        //         store.set("config.comPort", this.currentComPort);
        //     });
        // },

        // getSavedComPort() {
        //     this.currentComPort = store.get("config.comPort");
        //     console.log(this.currentComPort);
        // },

        comPortSelected() {
            console.log("saving com port ");
            store.set("config.comPort", this.currentComPort);
        },

        // getComPorts() {
        //     boardManager
        //         .getAllComPorts()
        //         .then((ports) => {
        //             this.comPorts = ports;
        //         })
        //         .catch(() => {
        //             this.comPorts = [{ path: "ERROR GETTING COM PORTS" }];
        //         });
        // },

    },
    mounted() {
        // this.getSavedComPort();
        // this.getComPorts();
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