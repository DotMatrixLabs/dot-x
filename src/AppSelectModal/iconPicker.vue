<template>
    <div :class="true ? 'modal-open' : ''" class="modal h-full w-full">
        <div class="modal-box overflow-hidden w-full max-w-xl h-2/3">
        <div class="w-full flex justify-center gap-4">
            <label class="mt-1">Select Icon</label>
            <input class="input input-bordered input-sm w-32 max-w-xs mx-2 capitalize truncate justify-end" v-model="search" placeholder="Search an icon">
        </div>
        <transition name="icon-preview-fade">
            <div class="mt-3">
                <RecycleScroller class="w-full h-48 px-4 overflow-y-scroll" gridItems="9" :items="iconsFiltered" item-size="52" key-field="title" prerender="0"
                v-slot="{ item }">
                    <div :key="item?.title" :title="item?.title" class="hover:bg-gray-800 transition-all active:scale-105 cursor-pointer h-12 p-2 flex flex-col justify-center items-center rounded-md">
                        <i class="fa-2xl" :class="item?.title" />
                    </div>
                </RecycleScroller>
            </div>
        </transition>
        </div>
    </div>
</template>

<script>

import { icons } from './iconlist.json';

export default {
    data() {
        return {
            search: '',
            selected: ''
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
        blur() {
            // Add your blur logic here
        },
        focus() {
            // Add your focus logic here
        },
        select(icon) {
            // Add your select logic here
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