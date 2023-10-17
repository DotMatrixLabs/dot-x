<template>
    <!-- Apps -->
    <div class="flex flex-row m-auto mb-2">
        <!-- Search not ready yet, disabling for now -->
        <span class="shrink-0 px-1 text-xs text-gray-300">
            Search for apps:
        </span>
        <input v-model="appSearch" type="text"
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
                    <div class="truncate cursor-pointer px-2 py-0.5 text-blue">
                        {{ item.DisplayName }}
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
// import getAllInstalledSoftwareSync from "../../js/win32.js";
// import ActionModal from "../components/ActionModal.vue";
// import { mapActions, mapState } from "pinia";
import _ from "lodash";
// import LoadingSpinner from "../assets/loadingSpinner.vue";

import { invoke } from "@tauri-apps/api/tauri";

// Be sure to set `build.withGlobalTauri` in `tauri.conf.json` to true

export default {

    components: {
        // ActionModal,
        // LoadingSpinner
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
            selectedApp: null,
        }
    },


    computed: {
        filterApps() {
            if (_.isEmpty(this.appList)) {
                return this.appList;
            }
            return this.appList.filter((app) =>
                app.DisplayName.toLowerCase().includes(this.appSearch.toLowerCase())
            );
        },
    },

    methods: {
        appAdded(appsObject) {
            store.addExtraApp(appsObject.displayName, appsObject.filePath);
            this.getAllApps();
        },

        removeClicked(name) {
            console.log("name: ", name);
        },

        getExtraApps() {
            const extraApps = store.get("extraApps");
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

        async getAllApps() {
            this.loading = true;
            const apps = await invoke('get_installed_apps')
            console.log(apps)
            // getAllInstalledSoftwareSync()
            //     .then((apps) => {
            //         apps = apps.filter((app) => app.DisplayName !== undefined);
            //         apps = _.orderBy(
            //             apps,
            //             [(app) => app.DisplayName.toLowerCase()],
            //             ["asc"]
            //         );
            //         apps = apps.concat(this.getExtraApps());
            //         apps.forEach((app, index) => (app.id = index + 1));
            //         this.appList = apps;
            //         this.fullAppList = apps;
            //         console.log({
            //             appList: this.appList,
            //         });
            //         this.loading = false;
            //     })
            //     .catch(() => {
            //         this.loading = false;
            //     });
        },

        selectSliderApp(app) {
            console.log({ emitted: app });
            this.$emit("appSelected", app);
            this.$emit("close");
        },
    },


    mounted() {
        this.getAllApps();
    },


}
</script>

<style lang="scss" scoped></style>