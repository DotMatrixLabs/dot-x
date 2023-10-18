import { Store } from "tauri-plugin-store-api";
import * as _ from "lodash"; // Make sure to import lodash if you haven't already
class SelectedApps {
    private store: Store;

    constructor() {
        this.store = new Store("selectedApps.json");
    }

    async toggleApp(sliderID: number, appName: string) {
        const key = sliderID.toString();
        const currentApps = await this.store.get(sliderID);
        if(!currentApps) await this.store.set(key, [appName]);
        else if(_.includes(currentApps, appName)){
            let applications = _.pull(currentApps, appName);
            this.store.set(key, applications);
        }
        else {
            let applications = [...currentApps, appName];
            
            await this.store.set(key, applications);
        }
        await this.store.save();
    }

    async getApps(sliderID: number): Promise<any> {
        const sliderIDString = sliderID.toString();
        return await this.store.get(sliderIDString);
    }

    async save() {
        await this.store.save();
    }

}

export default new SelectedApps();
