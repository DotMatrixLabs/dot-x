<template>
  <div v-if="open" class="modal modal-open h-full w-full">
    <div class="modal-box p-4 max-w-xl">
      <div class="flex justify-between items-start">
        <h3 class="font-bold text-lg">What’s New - {{store.currentVersion}}</h3>
        <button class="btn btn-ghost btn-xs btn-circle" @click="close">✕</button>
      </div>
      <div class="prose prose-h1:text-xl prose-h2:text-xl prose-h3:text-xl prose-h4:text-lg prose-h5:text-base prose-h6:text-sm prose-zinc dark:prose-invert max-w-none mt-3 whatsnew-content" v-html="html"></div>
      <!-- divider -->
      <div class="divider my-0 py-0"></div>
      <div class="modal-action mt-2 pb-0 mb-0 flex flex-row justify-between items-center">
        <!-- discuss  -->
        <a href="https://dml.gg/discord" target="_blank" rel="noreferrer">
         <span class="text-blue-500 hover:text-blue-300 cursor-pointer">Discuss on Discord</span>
        </a>
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
    open() { return true; },
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
