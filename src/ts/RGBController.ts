import { rainbow } from './rgb-effects/rainbow';
// import { setColor } from './setColor';

class RGBController {

    public rgbInterval: NodeJS.Timeout | null;

    constructor() {
        console.log('RGBController initialized');
        this.rgbInterval = null;
    }

    effects: { [key: string]: (...params: number[]) => void } = {
        rainbow,
        // setColor: (r: number, g: number, b: number) => setColor(r, g, b),
        // Add more effects as needed
    };

    public setEffect(effectName: string, ...params: number[]) {
        const effectFunction = this.effects[effectName];
        if (effectFunction) {
            const updateInterval = 1000; // Adjust this interval as needed
            this.rgbInterval = setInterval(() => {
                const response = effectFunction(...params);
                console.log(response);
            }, updateInterval);
        } else {
            console.error('Unknown effect: ' + effectName);
        }
    }

    
}

export default (new RGBController());


