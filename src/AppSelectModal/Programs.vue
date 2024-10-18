<template>
    <!-- Apps -->
    <div class="flex flex-row m-auto mb-2 justify-center items-center">
        <ActionModal :modalOpen="actionModalOpen" :modalSettings="modalSettings" @closeModal="actionModalOpen = false"
          @outputData="appAdded" />
        <!-- Search not ready yet, disabling for now -->
        <div class="h-full">
            <label class="label cursor-pointer">
                <span class="text-xs mx-2">All Apps</span> 
                <input type="checkbox" v-model="showAllApps" class="checkbox checkbox-primary checkbox-xs" />
            </label>
        </div>
        <input v-model="appSearch" type="text" placeholder="Search apps"
            class="input input-bordered input-xs w-2/3 max-w-xs mx-2 capitalize truncate" />
        <button @click="actionModalOpen = true" class="btn btn-xs">
            Add app
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
                    <button v-if="item.appType === 'custom'" class="mt-1" @click="removeClicked(item.DisplayName)">
                        <i class="fas fa-xmark m-auto w-4 h-4 p-1 rounded-full hover:bg-gray-500 hover:bg-opacity-30"></i>
                    </button>
                </button>
            </RecycleScroller>
        </div>
    </div>
</template>

<script>
import ActionModal from "../components/ActionModal.vue";
// import { mapActions, mapState } from "pinia";
import _ from "lodash";
import LoadingSpinner from "../assets/loadingSpinner.vue";

import ExtraApps from "../ts/extraApps.ts";
import SystemVolumeController from "../ts/volumeControl.ts";
import SelectedApps from "../ts/appsToControl.ts";
import { useToast } from "vue-toastification";


const toast = useToast();

import { invoke } from "@tauri-apps/api/tauri";

export default {

    components: {
        ActionModal,
        LoadingSpinner
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
            actionModalOpen: false,
            modalSettings: {
                title: "Manually add program",
                message:
                    "Please enter the the whole filename for the app you want to add. Ex: spotify.exe",
                modalType: "input",
                inputs: [
                    {
                        label: "Display Name",
                        type: "text",
                        placeholder: "Display Name",
                        variableName: "displayName",
                    },
                    {
                        label: "File path",
                        type: "text",
                        placeholder: "File path",
                        variableName: "filePath",
                    },
                ],
                closeButton: "Cancel",
                confirmButton: "Add",
            },
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
        async appAdded(appsObject) {
            await ExtraApps.addExtraApp(appsObject.displayName, appsObject.filePath);
            this.getAllApps();
        },

        removeClicked(name) {
            console.log("name: ", name);
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


    mounted() {
        this.refreshData();
    },


}
</script>

<style lang="scss" scoped></style>