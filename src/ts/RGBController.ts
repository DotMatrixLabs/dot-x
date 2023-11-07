import { rainbow } from './rgb-effects/rainbow';
// import { setColor } from './setColor';

class RGBController {

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
            console.log(effectFunction(...params));

            this.rgbInterval = setInterval(() => {
                let { r, g, b } = effectFunction(...params);
                console.log(r, g, b);
            }, 1000);
            
        } else {
            console.error('Unknown effect: ' + effectName);
        }
    }
}

export default (new RGBController());


