<template>
  <div v-if="open" class="modal modal-open h-full w-full">
    <div class="modal-box max-w-3xl">
      <div class="flex justify-between items-start">
        <h3 class="font-bold text-lg">What’s New</h3>
        <button class="btn btn-ghost btn-sm" @click="close">✕</button>
      </div>
      <div class="prose max-w-none mt-3" v-html="html"></div>
      <div class="modal-action">
        <button class="btn btn-primary" @click="close">Close</button>
      </div>
    </div>
  </div>
</template>

<script>
import { useUpdateStore } from '../store/updateStore';

export default {
  name: 'WhatsNewModal',
  setup() {
    const store = useUpdateStore();
    return { store };
  },
  computed: {
    open() { return this.store.whatsNewOpen; },
    html() { return this.store.changelogHtml; },
  },
  methods: {
    close() {
      this.store.whatsNewOpen = false;
      this.store.markWhatsNewShownFor(this.store.currentVersion);
    },
  }
}
</script>

<style scoped>
</style>


