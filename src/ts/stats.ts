import { Store } from "@tauri-apps/plugin-store";
import * as CryptoJS from 'crypto-js';

class Stats {
    private store: Store;
    private secretKey: string;

    constructor() {
        this.store = new Store("stats.x");
        this.secretKey = "madebyfrogs";
        setInterval(() => {
            this.save();
        }, 1000 * 60); //save every minute
    }

    async logSliderChange(slider: number, value: number) {
        if(isNaN(value)) return;
        const key = `slider-${slider}`;
        const oldValue: any = await this.store.get(key);
        if(!oldValue) {
            this.store.set(key, this.encrypt(value));
            return;
        }
        const decryptedOldValue = this.decrypt(oldValue) || "0";
        const newValue = parseInt(decryptedOldValue) + value;
        const cryptedValue = this.encrypt(newValue);
        this.store.set(key, cryptedValue);
    }

    sliderMovementToCentimeters(movement: number) {
        return ((movement / 100) * 6); //convert the 0 to 100 number to a 0 to 6 cm number - 6cm is the travel distance of the slider
    }

    async getSliderDistance(slider: number): Promise<string> {
        const key = `slider-${slider}`;
        const value: any = this.decrypt(await this.store.get(key) || "");
        const distance: any = this.formatDistance(value);
        return distance;
    }

    formatDistance(distance: any): string {
        if(distance === 'cheater') return "Are you trying to cheat?👀";
        const distanceInCentimeters = this.sliderMovementToCentimeters(distance);
        const centimeters = distanceInCentimeters;
        const meters = distanceInCentimeters / 100;
        const kilometers = distanceInCentimeters / 100000; // 1km = 100000cm
    
        if (kilometers >= 1) {
            return `${kilometers.toFixed(2)}km`;
        } else if (meters >= 1) {
            return `${meters.toFixed(2)}m`;
        } else {
            return `${centimeters.toFixed(2)}cm`;
        }
    }

    private isNumericString(input: string): boolean {
        return /^[0-9]+$/.test(input);
    }

    // Encrypt function
    private encrypt(value: any): string {
        value = value.toString();
        const encryptedValue = CryptoJS.AES.encrypt(value, this.secretKey).toString();
        return encryptedValue;
    }

    // Decrypt function
    private decrypt(encryptedValue: string): string {

        if(this.isNumericString(encryptedValue)) return 'cheater';

        const bytes = CryptoJS.AES.decrypt(encryptedValue, this.secretKey);
        const decryptedValue = bytes.toString(CryptoJS.enc.Utf8);

        return decryptedValue;
    }


    private async save() {
        await this.store.save();
    }

}

export default new Stats();
