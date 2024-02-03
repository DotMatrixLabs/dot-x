<template>
    <div :class="modalOpen ? 'modal-open' : ''" class="modal h-full w-full">
      <div class="modal-box overflow-hidden w-full max-w-xl h-2/3">
        <h1 class="font-bold text-lg text-center">Plugin {{ currentPlugin }}</h1>
        <div class="w-full">
          <ul class="menu rounded-box menu-compact p-2 flex flex-row w-full justify-center gap-2">
            <li v-for="tab in tabs" :key="tab">
              <a @click="selectTab(tab)" class="w-full text-center" :class="{ active: tab.isActive }">{{ tab.name }}</a>
            </li>
          </ul>
          <div class="col-span-2 pb-6 pt-2">
            <ul class="menu rounded-box menu-compact p-2 flex flex-row w-full justify-center gap-2">
                <li v-for="tab in tabs" :key="tab">
                <span>test</span>
                </li>
            </ul>
          </div>
        </div>
  
      </div>
      <div class="modal-action fixed bottom-5 left-1/2 transform -translate-x-1/2">
        <button @click="modalOpen = false" class="btn mx-auto">Close</button>
      </div>
    </div>
  </template>

<script>
    export default {

        data() {
            return {
                modalOpen: false,
            }
        },

        methods: {
            selectTab(selectedTab) {
                this.tabs.forEach(tab => {
                    tab.isActive = tab.name === selectedTab.name;
                });
            },
            open(pluginName) {
                console.log("Open plugin settings", pluginName);
                this.modalOpen = true;
                this.currentPlugin = pluginName;
            },
        },

        
    }
</script>

<style lang="scss" scoped>

</style>