import Decker from './decker';

class RGBController {
    effects: string[];
    private lastRGBExecutionTime: number = 0;
    private rgbTimeoutId: NodeJS.Timeout | null = null;
    private latestRGBValues: { effectName: string; speed: number; brightness: number; color: string } | null = null;

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
        if (!this.effects.includes(effectName)) {
            console.error('Unknown effect: ' + effectName);
            return;
        }

        // Store the latest values
        this.latestRGBValues = { effectName, speed, brightness, color };

        const currentTime = Date.now();

        // If the throttling interval has passed, send the RGB values immediately
        if (currentTime - this.lastRGBExecutionTime >= 100) {
            this.lastRGBExecutionTime = currentTime;
            this.sendRGBCommand(effectName, speed, brightness, color);
            return;
        }

        // Clear the previous timeout if it exists
        if (this.rgbTimeoutId) {
            clearTimeout(this.rgbTimeoutId);
        }

        // Schedule the last value to be sent after the throttling interval
        this.rgbTimeoutId = setTimeout(() => {
            this.lastRGBExecutionTime = Date.now();
            if (this.latestRGBValues) {
                this.sendRGBCommand(
                    this.latestRGBValues.effectName,
                    this.latestRGBValues.speed,
                    this.latestRGBValues.brightness,
                    this.latestRGBValues.color
                );
            }
        }, 100 - (currentTime - this.lastRGBExecutionTime));
    }

    private sendRGBCommand(effectName: string, speed: number, brightness: number, color: string) {
        const options = { effect: effectName, speed: speed, brightness: brightness, color: color };
        Decker.sendCommand('rgb-control', options);
        console.log('RGB command sent:', options);
    }
    

    
}

export default (new RGBController());


