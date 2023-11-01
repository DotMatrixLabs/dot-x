import { emit, listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import SliderOverview from '../SliderOverview.vue';

class Decker {
    private comPort: string = "COM4";
    private debug: boolean;
    public sliders: Array<number> = [];

    constructor(comPort: string = "COM4") {
        this.comPort = comPort;
        this.debug = true;
        this.init();
    }
    private async init(){
        await invoke('connect_decker', { comPort: this.comPort });
        await invoke('init_process');
        
        const unlisten = await listen('slider-change', (event) => {
            // console.log(event);
            // console.log(event.payload.message);
            // Split event.payload.message on comma and add it to sliders array
            this.sliders = event.payload.message.split(',').map(Number);
            // console.log(this.sliders);
          })

        // setTimeout(() => {
        //     emit('slider-change', { value: 10 });
        //     console.log('emittd');
        // }, 2500);
    }

}

export default (new Decker());