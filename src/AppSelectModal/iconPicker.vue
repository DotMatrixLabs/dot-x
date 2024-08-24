<template>
    <div class="flex flex-row gap-6">
        <div class="join">
            <button @click="modalOpen = true" class="btn btn-sm join-item">
                <span v-if="!selectedIcon"> <i class="fa-solid fa-smile"></i> <span class="mx-2"> Select</span></span>
                <span :key="selectedIcon" v-else><i class="fa-md" :class="selectedIcon" /> <span class="mx-2"> Change</span></span>
            </button>
            <button @click="selectIcon('')" class="btn btn-sm join-item"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div :class="modalOpen ? 'modal-open' : ''" class="modal h-full w-full">
            <div class="modal-box overflow-hidden w-full max-w-xl h-3/4">
            <button @click="modalOpen = false" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
            <div class="w-full flex justify-center gap-4">
                <label class="text text-lg font-bold">Select Icon</label>
                <input class="input input-bordered input-sm w-32 max-w-xs mx-2 capitalize truncate justify-end" v-model="search" placeholder="Search an icon">
            </div>
            <transition name="icon-preview-fade">
                <div class="mt-3">
                    <RecycleScroller class="w-full h-48 px-4 overflow-y-scroll" gridItems="9" :items="iconsFiltered" item-size="52" key-field="title" prerender="0"
                    v-slot="{ item }">
                        <div @click="selectIcon(item?.title)" :class="selectedIcon == item?.title ? 'bg-primary hover:opacity-70' : 'hover:bg-gray-800'" :key="item?.title" :title="item?.title" class=" transition-all active:scale-105 m-1 cursor-pointer h-12 w-12 p-2 flex flex-col justify-center items-center rounded-md">
                            <i class="fa-2xl" :class="item?.title" />
                        </div>
                    </RecycleScroller>
                </div>
            </transition>
            </div>
        </div>
    </div>
</template>

<script>

import { icons } from './iconlist.json';

export default {
    data() {
        return {
            search: '',
            selectedIcon: '',
            modalOpen: false
        };
    },
    computed: {
        iconsFiltered(){
            return icons.filter(icon => 
                icon.title.indexOf(this.search) !== -1 || icon.searchTerms.some(t => t.indexOf(this.search) !== -1)
            )
        }
    },
    methods: {
        selectIcon(icon) {
            console.log(icon);
            console.log(this.selectedIcon);
            if(icon === this.selectedIcon) icon = '';
            this.selectedIcon = '';
            this.selectedIcon = icon;
            console.log(this.selectedIcon);
            this.$emit('icon-selected', icon);
            this.modalOpen = false;
        }
    }
};
</script>

<style>
.icon-preview-fade-enter-active, .icon-preview-fade-leave-active {
    transition: opacity .25s;
}
.icon-preview-fade-enter, .icon-preview-fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
    opacity: 0;
}
  .icon-preview-fade-enter-active, .icon-preview-fade-leave-active {
    transition: opacity .25s;
  }
  .icon-preview-fade-enter, .icon-preview-fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
    opacity: 0;
  }
</style>