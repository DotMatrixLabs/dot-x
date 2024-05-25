import Decker from './decker';

class RGBController {
    effects: string[];

    constructor() {
        console.log('RGBController initialized');
        this.effects = [
            'rainbow',
            'static',
            'off',
            'lightningStorm',
            'candle',
            'perimeter',
            'breathing'
        ]
    }

    public setEffect(effectName: string, speed: number, brightness: number, color: string) {
        if (this.effects.includes(effectName)) {
            const options = {effect: effectName, speed: speed, brightness: brightness, color: color};
            Decker.sendCommand('rgb-control', options);
        } else {
            console.error('Unknown effect: ' + effectName);
        }
    }
    

    
}

export default (new RGBController());


