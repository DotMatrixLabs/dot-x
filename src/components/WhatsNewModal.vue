<template>
  <div v-if="open" class="modal modal-open h-full w-full">
    <div class="modal-box p-4 max-w-xl">
      <div class="flex justify-between items-start">
        <h3 class="font-extrabold text-xl text-white">What’s New - {{store.currentVersion}}</h3>
        <button class="btn btn-ghost btn-xs btn-circle" @click="close">✕</button>
      </div>
      <div class="divider my-0 py-0"></div>
      <div ref="content" class="prose prose-invert prose-h1:text-xl prose-h2:text-xl prose-h3:text-xl prose-h4:text-lg prose-h5:text-base prose-h6:text-sm max-w-none mt-3 font-sans" v-html="html"></div>
      <!-- divider -->
      <div class="divider my-0 py-0"></div>
      <div class="modal-action mt-2 pb-0 mb-0 flex flex-row justify-end items-center">
        <button class="btn btn-primary" @click="close">Close</button>
      </div>
    </div>
  </div>
</template>

<script>
import { useUpdateStore } from '../store/updateStore';
import { open } from '@tauri-apps/api/shell';

export default {
  name: 'WhatsNewModal',
  setup() {
    const store = useUpdateStore();
    return { store };
  },
  data() {
    return {
      contentRef: null
    };
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
    handleLinkClick(event) {
      // Check if the clicked element is a link
      if (event.target.tagName === 'A') {
        event.preventDefault();
        const url = event.target.href;
        if (url) {
          open(url).catch(console.error);
        }
      }
    },
    attachLinkListeners() {
      if (this.contentRef) {
        this.contentRef.addEventListener('click', this.handleLinkClick);
      }
    },
    detachLinkListeners() {
      if (this.contentRef) {
        this.contentRef.removeEventListener('click', this.handleLinkClick);
      }
    }
  },
  mounted() {
    this.contentRef = this.$refs.content;
    this.attachLinkListeners();
  },
  updated() {
    // Re-attach listeners after content updates
    this.detachLinkListeners();
    this.attachLinkListeners();
  },
  beforeUnmount() {
    this.detachLinkListeners();
  }
}
</script>

<style scoped>
.prose :is(h1, h2, h3, h4, h5, h6, p, li, a) {
  @apply text-white font-sans;
}
</style>
