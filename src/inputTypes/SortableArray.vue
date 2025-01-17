<template>
    <div class="w-full flex flex-col md:flex-row max-w-sm md:max-w-lg m-auto">
        <label class="label w-full mx-2">
            <span class="label-text">{{ label }}</span>
        </label>
        <label @click="$emit('scrollToTop', true)" for="arrayList" class="btn btn-md btn-outline">
            {{ buttonTitle }}
        </label>
        <input type="checkbox" id="arrayList" class="modal-toggle" />
        <div for="arrayList" class="modal">
            <div class="modal-box realtive">

                <label for="arrayList" class="btn btn-sm btn-circle absolute right-2 top-2">✕</label>
                <h3 class="text-base md:text-xl lg:text-3xl font-bold text-center pb-6">{{ label }}</h3>
                <div class="flex flex-col justify-center items-center text-sm">
                    <SlickList @update:list="sendList" axis="y" class="z-50" v-model:list="sortedList">
                        <SlickItem class="slickItem bg-secondary text-white w-full" v-for="(option, i) in sortedList"
                            :key="option" :index="i">
                            <div class="flex flex-row items-center justify-between px-2 select-none">
                                <DragHandle>
                                    <font-awesome-icon icon="fa-solid fa-bars" size="xl" />
                                    X
                                </DragHandle>
                                <span class="ml-4 px-2 text-xl text-clip">{{ option.name }}</span>
                            </div>
                        </SlickItem>
                    </SlickList>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { SlickList, SlickItem, DragHandle } from 'vue-slicksort';

export default {

    props: {
        options: {
            type: Object,
            default: {}
        },
        label: {
            type: String,
            default: 'Title'
        },
        value: {
            type: Object,
            default: {}
        },
        buttonTitle: {
            type: String,
            default: 'Open'
        }
    },

    components: {
        SlickList,
        SlickItem,
        DragHandle
    },

    data() {
        return {
            preSorted: {},
            sortedList: {},
        }
    },

    watch: {
        options: {
            handler(newList) {
                this.sortedList = newList
            },
            immediate: true, // Run the handler immediately when the component is created
            deep: true
        },
    },

    methods: {
        arrayToObject(array) {
            const obj = array.reduce((acc, { name, value }, index) => {
                acc[name] = value;
                return acc;
            }, {});

            return obj
        },



        sendList(newArray) {
            this.$emit('apply', newArray);
        },


    },
}
</script>

<style scoped>
.slickItem {
    z-index: 10000;
    border-radius: 0.25rem;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    padding: 0.5rem;
    margin-bottom: 0.5rem;
    cursor: grab;


}

.centerVertical {
    position: absolute;
    left: 50%;
    transform: translate(-50%, 0);
}
</style>