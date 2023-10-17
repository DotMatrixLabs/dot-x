<template>
    <div>
        <div class="flex flex-row">
            <span class="shrink-0 pt-1">Device: </span>
            <select @change="comPortSelected" v-model="currentComPort"
                class="select select-bordered select-sm w-2/3 max-w-xs mx-2 capitalize truncate">
                <option v-for="(comPort, index) in comPorts" :value="comPort" :key="index">
                    {{ `${comPort.path} - ${comPort.manufacturer}` }}
                </option>
            </select>
            <button @click="detectBoard" title="Autodiscover" class="btn btn-circle btn-sm">
                <i class="fa-solid fa-magnifying-glass"></i>
            </button>
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
        }
    },
    methods: {
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

<style lang="scss" scoped></style>