import { rainbow } from './rgb-effects/rainbow';
import { setColor } from './rgb-effects/staticColor';

// import { setColor } from './setColor';
import Decker from './decker';

class RGBController {

    constructor() {
    }

    effects: { [key: string]: (...params: number[]) => void } = {
        rainbow,
        setColor,
    };

    public setEffect(effectName: string, ...params: number[]) {
        const effectFunction = this.effects[effectName];
        if (effectFunction) {
            const response: any = effectFunction(...params);
            const options = { r: parseInt(response.r), g: parseInt(response.g), b: parseInt(response.b)};
            Decker.sendCommand('rgb-control', options);
            // const updateInterval = 400; // Adjust this interval as needed
            // this.rgbInterval = setInterval(() => {
            //     const response: any = effectFunction(...params);
            //     console.log(response);
            //     const options = { r: parseInt(response.r), g: parseInt(response.g), b: parseInt(response.b)};
            //     Decker.sendCommand('rgb-control', options);
                
            // }, updateInterval);
        } else {
            console.error('Unknown effect: ' + effectName);
        }
    }

    
}

export default (new RGBController());


