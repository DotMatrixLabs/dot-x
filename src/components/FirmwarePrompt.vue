<template>
  <div v-if="firmware.showPrompt" class="modal modal-open h-full w-full">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Decker firmware update</h3>
      <p class="mt-2 opacity-90">
        Firmware {{ firmware.available }} is ready for your Decker (you have {{ firmware.deviceVersion }}).
      </p>
      <p class="mt-2 text-sm opacity-60">The update takes about 10 seconds. Sliders pause while it runs.</p>
      <div class="modal-action">
        <button class="btn" @click="firmware.dismissPrompt()">Later</button>
        <button class="btn btn-primary" @click="updateNow">Update now</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFirmwareStore } from '../store/firmwareStore';

const emit = defineEmits<{ (e: 'open-settings'): void }>();
const firmware = useFirmwareStore();

async function updateNow() {
  emit('open-settings');
  const flashing = firmware.flash();
  await firmware.dismissPrompt();
  await flashing;
}
</script>
