<template>
    <div :class="true ? 'modal-open' : ''" class="modal h-full w-full">
        <div class="modal-box overflow-hidden w-full max-w-xl h-2/3">
        <label for="exampleFormControlInput1">Font awesome icon :</label>
        <input ref="picker" v-model="search" @blur="blur" @focus="focus" type="email" class="form-control" id="exampleFormControlInput1" placeholder="Search an icon">
        <transition name="icon-preview-fade">
            <div class="mt-3">
                <RecycleScroller class="w-full h-40 px-4 overflow-y-scroll" gridItems="12" :items="iconsFiltered" item-size="40" key-field="title" prerender="0"
                v-slot="{ item }">
                <div class="hover:bg-gray-800 cursor-pointer h-8 w-8 p-2 flex flex-col justify-center items-center rounded-md">
                    <i class="fa-xl" :class="item?.title" />
                </div>

                    <!-- <button class="btn">
                        <i :class="item?.title" />
                    </button> -->
                </RecycleScroller>
                <!-- <div @click="select(undefined)">
                    <div v-for="(icon, index) in iconsFiltered" class="icon-preview">
                        <div @click.prevent.stop="select(icon)" :class="['icon-wrapper','rounded','shadow-sm', {selected: icon.title == selected}]" >
                            <i :class="icon.title" />
                        </div>
                    </div>
                </div> -->
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
            focusOn: false,
            hoverPanel: false,
            selected: ''
        };
    },
    computed: {
        iconsFiltered() {
            // Add your filtering logic here
            return icons;
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