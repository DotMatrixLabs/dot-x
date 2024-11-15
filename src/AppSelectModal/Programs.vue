<template>
    <HelpBox ref="helpBox" class="p-12" />
    <!-- Apps -->
    <div class="flex flex-row m-auto mb-2 justify-center items-center">
        <div class="h-full">
            <label class="label cursor-pointer">
                <span class="text-xs mx-2">All Apps</span> 
                <input type="checkbox" v-model="showAllApps" class="checkbox checkbox-primary checkbox-xs" />
            </label>
        </div>
        <input v-model="appSearch" type="text" placeholder="Search apps"
            class="input input-bordered input-xs w-2/3 max-w-xs mx-2 capitalize truncate" />
        <button @click="openHelpModal" class="btn btn-circle btn-xs btn-primary btn-outline" title="Help" aria-label="Open help modal">
            <i class="fas fa-info h-3 w-3"></i>
        </button>
    </div>
    <div class="flex flex-col overflow-y-auto overflow-x-hidden h-40 w-full p-4 bg-base-200 rounded-lg relative">
        <div v-if="loading" class="absolute bg-gray-900 h-full w-full left-0 top-0 bg-opacity-50">
            <div class="absolute transform left-1/2 -translate-x-1/2 top-1/2">
                <LoadingSpinner />
            </div>
        </div>
        <div v-if="filterApps">
            <RecycleScroller class="w-full px-4" :items="filterApps" :item-size="32" key-field="id" :prerender="0"
                v-slot="{ item }">
                <button class="hover:bg-base-100 rounded-lg w-full flex flex-row justify-between"
                    @click="selectSliderApp(item)">
                    <input type="checkbox" :checked="selectedApps?.includes(item.DisplayName)" class="checkbox checkbox-primary checkbox-xs m-auto" />

                    <div class="truncate capitalize cursor-pointer px-2 py-0.5 text-blue w-full text-left mx-2">
                        {{ item.DisplayName.toLowerCase() }}
                    </div>
                </button>
            </RecycleScroller>
        </div>
    </div>
</template>

<script>
import HelpBox from "../components/HelpBox.vue";
import _ from "lodash";
import LoadingSpinner from "../assets/loadingSpinner.vue";
import ExtraApps from "../ts/extraApps.ts";
import SystemVolumeController from "../ts/volumeControl.ts";
import SelectedApps from "../ts/appsToControl.ts";
import { useToast } from "vue-toastification";

const toast = useToast();

import { invoke } from "@tauri-apps/api/core";

export default {

    components: {
        LoadingSpinner,
        HelpBox
    },

    props: {
        currentSliderID: {
            type: Number,
            default: null,
        },
    },


    data() {
        return {
            appSearch: "",
            currentComPort: null,
            comPortInterval: null,
            appList: [],
            fullAppList: [],
            searchResults: [],
            loading: false,
            selectedApps: [""],
            activeApps: [],
            showAllApps: false,
            duplicates: [],
            systemUtilities: [
                "master",
                "mic",
                "unmapped",
                "activeWindow",
                "midi"
            ],
            getActiveAppsInterval: null
        }
    },


    computed: {
        filterApps() {
            let appList = this.showAllApps ? this.appList : this.activeApps;
            if (_.isEmpty(appList)) {
                return appList;
            }
            return appList.filter((app) =>
                app.DisplayName.toLowerCase().includes(this.appSearch.toLowerCase())
            );
        },
    },

    methods: {

        openHelpModal() {
            this.$refs.helpBox.openHelpBox("Add a program", `
            The list shows all apps currently running on your system.

            To select an app that isn’t running, check the box at the top of the list to display all apps. You can also use the search bar to find specific apps.

            Please note:

                - If the app you want to add is not appearing in the list, try relaunching the app and checking the list again.

                - Some apps, like Spotify, need to be actively playing audio to appear.

                - If you’re still having issues, try launching Dot X in administrator mode to ensure all apps are displayed.
                
                `);
        },

        async appAdded(appsObject) {
            await ExtraApps.addExtraApp(appsObject.displayName, appsObject.filePath);
            this.getAllApps();
        },

        async getExtraApps() {
            const extraApps = await ExtraApps.getExtraApps();
            const extraAppsArray = [];
            if (!_.isEmpty(extraApps)) {
                Object.keys(extraApps).forEach((app) => {
                    extraAppsArray.push(extraApps[app]);
                });
            }
            console.log({
                extraAppsArray: extraAppsArray,
            });
            return extraAppsArray;
        },

        async getActiveApps() {
            let activeApps = await SystemVolumeController.getAllSessionNames();
            activeApps = activeApps.filter((str) => str !== ""); // Remove empty entries
            //check if an app has the same name, and ends in (1), (2), (3), etc and create an array of duplicates
            this.duplicates = activeApps.filter((str) => str.match(/\(\d+\)$/));
            //remove the number and keep the original
            activeApps = activeApps.map((str) => str.replace(/\(\d+\)$/, '').trim());
            activeApps = _.uniqBy(activeApps, item => item.toLowerCase());
            activeApps = activeApps.map((str) => ({ DisplayName: str, id: str, appType: 'active'}));
            this.activeApps = activeApps;
        },

        async getAllApps() {
            this.loading = true;
            const extraApps = await this.getExtraApps();
            invoke('get_installed_apps')
                .then((apps) => {
                    apps = apps.app_list.filter((str) => str !== ""); // Remove empty entries
                    apps = apps.map((str) => ({ DisplayName: str }));
                    apps = _.orderBy(
                        apps,
                        [(app) => app.DisplayName.toLowerCase()],
                        ["asc"]
                    );
                    apps = apps.concat(extraApps);
                    apps.forEach((app, index) => (app.id = index + 1));
                    this.appList = apps;
                    this.fullAppList = apps;
                    this.loading = false;
                })

                .catch(() => {
                    this.loading = false;
                });

                // Put selected apps at the top of the list
                await this.getSelectedApps();
                this.appList.forEach((app, index) => {
                    const selectedApp = this.selectedApps?.find((str) => str === app.DisplayName);
                    console.log({selectedApp});
                    if(selectedApp) {
                        this.appList.splice(index, 1);
                        this.appList.unshift(app);
                    }
                })

                //first filter out the system utilities from the selected apps list
                if(!this.selectedApps) return;
                this.selectedApps = this.selectedApps.filter((str) => !this.systemUtilities.includes(str));

                //Then add the selected apps that are not in the list to the top of the list
                this.selectedApps.forEach((selectedApp) => {
                    const app = this.appList.find((str) => str.DisplayName === selectedApp);
                    if(!app) {
                        this.appList.unshift({DisplayName: selectedApp, id: this.appList.length + 1, appType: 'selected'});
                    }
                })


        },

        selectSliderApp(app) {
            //if app display name is the same name as the duplicate with the number removed, add the duplicate to the array
            if(this.duplicates.some((str) => str.replace(/\(\d+\)$/, '').trim() === app.DisplayName)) {
                app.duplicates = this.duplicates.filter((str) => str.replace(/\(\d+\)$/, '').trim() === app.DisplayName);
            } else {
                app.duplicates = [];
            }
            const allApps = [app.DisplayName, ...app.duplicates];
            SelectedApps.toggleApps(this.currentSliderID.toString(), allApps).then(() => {
                this.getSelectedApps();
            })
        },

        async getSelectedApps() {
            this.selectedApps = await SelectedApps.getApps(this.currentSliderID?.toString());
        },

        refreshData() {
            this.getAllApps();
            this.getActiveApps();
            this.getSelectedApps();
        },


    },

    beforeUnmount(){
        clearInterval(this.getActiveAppsInterval);
    },


    mounted() {
        this.refreshData();
        this.getActiveAppsInterval = setInterval(()=> {
            this.getActiveApps();
        }, 1000)
    },


}
</script>

<style lang="scss" scoped></style>