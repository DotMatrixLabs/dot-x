import { Store } from "@tauri-apps/plugin-store";
import * as CryptoJS from 'crypto-js';

const FINGERPRINT_KEY = "key-fingerprint";

class Stats {
    private store!: Store;
    private loading?: Promise<Store>;
    private secretKey: string;

    constructor() {
        this.secretKey = import.meta.env.VITE_STATS_SECRET_KEY || "";
        setInterval(() => {
            this.save();
        }, 1000 * 60); //save every minute
    }

    private async ensureLoaded(): Promise<Store> {
        if (!this.loading) {
            this.loading = (async () => {
                const store = await Store.load("stats.x");
                await this.syncKey(store);
                return store;
            })();
            this.loading.catch(() => {
                this.loading = undefined;
            });
        }
        this.store = await this.loading;
        return this.store;
    }

    private async syncKey(store: Store) {
        const fingerprint = CryptoJS.SHA256(this.secretKey).toString(CryptoJS.enc.Hex).slice(0, 16);
        const stored = await store.get<string>(FINGERPRINT_KEY);
        if (stored === fingerprint) return;

        if (stored === undefined && await this.entriesReadable(store)) {
            await store.set(FINGERPRINT_KEY, fingerprint);
            await store.save();
            return;
        }

        for (const key of await store.keys()) {
            await store.delete(key);
        }
        await store.set(FINGERPRINT_KEY, fingerprint);
        await store.save();
    }

    private async entriesReadable(store: Store): Promise<boolean> {
        for (const [key, value] of await store.entries<string>()) {
            if (key === FINGERPRINT_KEY) continue;
            const decrypted = this.decrypt(typeof value === "string" ? value : "");
            if (decrypted === 'cheater') continue;
            if (!this.isNumericString(decrypted)) return false;
        }
        return true;
    }

    async logSliderChange(slider: number, value: number) {
        const store = await this.ensureLoaded();
        if(isNaN(value)) return;
        const key = `slider-${slider}`;
        const oldValue: any = await store.get(key);
        if(!oldValue) {
            await store.set(key, this.encrypt(value));
            return;
        }
        const decryptedOldValue = this.decrypt(oldValue);
        if(decryptedOldValue === 'cheater') return;
        const previous = parseInt(decryptedOldValue, 10);
        const newValue = isNaN(previous) ? value : previous + value;
        const cryptedValue = this.encrypt(newValue);
        await store.set(key, cryptedValue);
    }

    sliderMovementToCentimeters(movement: number) {
        return ((movement / 100) * 6); //convert the 0 to 100 number to a 0 to 6 cm number - 6cm is the travel distance of the slider
    }

    async getSliderDistance(slider: number): Promise<string> {
        const store = await this.ensureLoaded();
        const key = `slider-${slider}`;
        const value: any = this.decrypt(await store.get(key) || "");
        if(value !== 'cheater' && !this.isNumericString(value)) return this.formatDistance(0);
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

        try {
            const bytes = CryptoJS.AES.decrypt(encryptedValue, this.secretKey);
            return bytes.toString(CryptoJS.enc.Utf8);
        } catch {
            return "";
        }
    }


    private async save() {
        const store = await this.ensureLoaded();
        await store.save();
    }

}

export default new Stats();
