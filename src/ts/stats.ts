import { Store } from "tauri-plugin-store-api";

class Stats {
    private store: Store;

    constructor() {
        this.store = new Store("stats.x");
        setInterval(() => {
            this.save();
        }, 1000 * 60); //save every minute
    }

    async logSliderChange(slider: number, value: number) {
        if(isNaN(value)) return;
        const key = `slider-${slider}`;
        const oldValue: number = await this.store.get(key) || 0;
        const newValue = oldValue + value;
        this.store.set(key, newValue);
    }

    sliderMovementToCentimeters(movement: number) {
        return ((movement / 100) * 6); //convert the 0 to 100 number to a 0 to 6 cm number - 6cm is the travel distance of the slider
    }

    async getSliderDistance(slider: number): Promise<string> {
        const key = `slider-${slider}`;
        const value: number = await this.store.get(key) || 0;
        const distance: string = this.formatDistance(value);
        return distance;
    }

    formatDistance(distance: number): string {
        const distanceInCentimeters = this.sliderMovementToCentimeters(distance);
        const centimeters = distanceInCentimeters;
        const meters = distanceInCentimeters / 100;
        const kilometers = distanceInCentimeters / 10000;
    
        if (kilometers >= 1) {
            return `${kilometers.toFixed(2)}km`;
        } else if (meters >= 1) {
            return `${meters.toFixed(2)}m`;
        } else {
            return `${centimeters.toFixed(2)}cm`;
        }
    }

    private async save() {
        await this.store.save();
    }

}

export default new Stats();
