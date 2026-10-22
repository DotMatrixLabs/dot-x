<template>
  <div v-if="open" class="modal modal-open h-full w-full">
    <div class="modal-box p-4 max-w-xl">
      <div class="flex justify-between items-start">
        <h3 class="font-bold text-xl text-white">What’s New - {{store.availableVersion ?? store.currentVersion}}</h3>
        <button class="btn btn-ghost btn-xs btn-circle" @click="close">✕</button>
      </div>
      <div class="divider my-0 py-0"></div>
      <div v-if="store.changelogHtml === ''" class="flex justify-center items-center mt-8 mb-8 h-28">
        <loadingSpinner />
      </div>
      <div
        v-else
        ref="contentRef"
        class="mt-3 font-sans text-sm leading-relaxed text-white text-opacity-90 space-y-3"
        v-html="html"
      ></div>
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
import loadingSpinner from '../assets/loadingSpinner.vue';

export default {
  name: 'WhatsNewModal',
  components: {
    loadingSpinner,
  },
  setup() {
    const store = useUpdateStore();
    return { store };
  },
  data() {
    return {
      contentRef: null,
      contentObserver: null
    };
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
  },
  // mounted() {
  //   // Delegate link clicks to open via Tauri shell.open
  //   const handler = async (event) => {
  //     const target = event.target;
  //     if (!(target instanceof HTMLElement)) return;
  //     const anchor = target.closest('a');
  //     if (!anchor) return;
  //     const href = anchor.getAttribute('href');
  //     if (!href) return;
  //     event.preventDefault();
  //     try {
  //       const { open } = await import('@tauri-apps/api/shell');
  //       await open(href);
  //     } catch (error) {
  //       console.error('Failed to open link:', error);
  //     }
  //   };
  //   this._linkHandler = handler;
  //   this.$nextTick(() => {
  //     if (this.$refs.contentRef) {
  //       this.$refs.contentRef.addEventListener('click', this._linkHandler, { capture: true });
  //     }
  //   });
  // },
  // beforeUnmount() {
  //   if (this.$refs.contentRef && this._linkHandler) {
  //     this.$refs.contentRef.removeEventListener('click', this._linkHandler, { capture: true });
  //   }
  // },
}
</script>
