import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import { useDeckerStore } from "../store/deckerStore.ts";
class Decker {
    private comPort: string = "";
    // private debug: boolean;
    public sliders: Array<number> = [];

    constructor() {
        this.comPort = "";
    }

    public retryConnection(){
        this.init(this.comPort);
    }


    public async init(comPort: string){
        const deckerStore = useDeckerStore();

        this.comPort = comPort;

        console.log("Connecting to Decker...", comPort)

        await invoke('connect_decker', { portName: comPort }).then(() => {
            console.log("Decker Connected!")
            deckerStore.setConnected(true);
        }).catch((error) => {
            console.log("Error connecting to Decker😭😭",error)
            deckerStore.setConnected(false);
        });
        // await invoke('init_process');

        await listen('connection-change', (event: any) => {
            if(event.payload.message === "connected"){
                deckerStore.setConnected(true);
            } else if (event.payload.message === "disconnected"){
                deckerStore.setConnected(false);
            }
        })
        
        const unlisten = await listen('slider-change', (event: any) => {
            deckerStore.setConnected(true);
            // Split event.payload.message on comma and add it to sliders array
            const jsonString = event.payload.message;
            const jsonObject = JSON.parse(jsonString);
            const sliderArray: Array<number> = Object.values(jsonObject);
            this.sliders = sliderArray;
            deckerStore.setSliders(this.sliders);
            // console.log(this.sliders);
        })

        console.log(unlisten)

        // setTimeout(() => {
        //     emit('slider-change', { value: 10 });
        //     console.log('emittd');
        // }, 2500);
    }

    
    public async getDevices() {
        return await invoke('get_devices');
    }

    public async getMidiDevices() {
        return await invoke('get_available_midi_output_port_names');
    }

}

export default (new Decker());

