import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import { useDeckerStore } from "../store/deckerStore.ts";

class Decker {
    private comPort: string = "COM4";
    // private debug: boolean;
    public sliders: Array<number> = [];

    constructor(comPort: string = "COM4") {
        this.comPort = comPort;
    }

    public async init(){
        const deckerStore = useDeckerStore();

        await invoke('connect_decker', { comPort: this.comPort }).then((test) => {
            console.log("test",test)
        }).catch((error) => {
            console.log("error",error)
        });
        // await invoke('init_process');

        const test = await listen('error', (event: any) => {
            console.log(event)
        })
        
        const unlisten = await listen('slider-change', (event: any) => {
            // console.log(event.payload.message);
            // Split event.payload.message on comma and add it to sliders array
            this.sliders = event.payload.message.split(',').map(Number);
            deckerStore.setSliders(this.sliders);
            // console.log(this.sliders);
        })

        console.log(unlisten)



        console.log(test)

        // setTimeout(() => {
        //     emit('slider-change', { value: 10 });
        //     console.log('emittd');
        // }, 2500);
    }

}

export default (new Decker());

