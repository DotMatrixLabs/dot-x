<template>
  <div class="flex flex-col gap-4 w-full">
    <div v-for="(field, key) in schema" :key="key" class="w-full">
      <!-- Text / Number / Password / etc. -->
      <div v-if="isInput(field.type)" class="form-control w-full">
        <label class="label">
          <span class="label-text">{{ field.label }}</span>
        </label>
        <input
          :type="inputType(field.type)"
          v-model="values[key]"
          :placeholder="field.placeholder"
          class="input input-bordered w-full"
        />
      </div>

      <!-- Boolean -->
      <div v-else-if="field.type === 'boolean'" class="form-control w-full flex-row gap-2 items-center">
        <input type="checkbox" v-model="values[key]" class="checkbox" />
        <span>{{ field.label }}</span>
      </div>

      <!-- Select -->
      <div v-else-if="field.type === 'select'" class="form-control w-full">
        <label class="label">
          <span class="label-text">{{ field.label }}</span>
        </label>
        <select v-model="values[key]" class="select select-bordered w-full">
          <option v-for="opt in field.options" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <!-- Button -->
      <div v-else-if="field.type === 'button'" class="form-control w-full">
        <button
          class="btn btn-sm"
          :class="buttonClass(field.style)"
          @click="handleButton(field)"
        >
          {{ field.text || field.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import EventBus from '../js/eventBus.js';
import PluginAPI from '../plugin-api/pluginAPI';
import type { SettingsSchema, ButtonField } from '../plugin-api/schema';

// Props
const props = defineProps<{
  schema: SettingsSchema;
}>();

// Reactive values map
const values = reactive<Record<string, any>>({});

// Initialize default values
Object.entries(props.schema).forEach(([key, field]) => {
  values[key] = field.default ?? null;
});

function isInput(type: string) {
  return ['text', 'password', 'textarea', 'color', 'file', 'number'].includes(type);
}
function inputType(type: string) {
  if (type === 'password') return 'password';
  if (type === 'number') return 'number';
  if (type === 'color') return 'color';
  return 'text';
}
function buttonClass(style?: string) {
  if (style === 'primary') return 'btn-primary';
  if (style === 'secondary') return 'btn-secondary';
  if (style === 'danger') return 'btn-error';
  return '';
}

async function handleButton(field: ButtonField) {
  if (!field.actionId) {
    console.warn('Button field missing actionId');
    return;
  }
  // Emit action to plugin via backend
  await PluginAPI.emitSettingsAction(field.actionId);
}

// Example: watch values and emit change (optional)
watch(values, (newVal) => {
  EventBus.emit('plugin-settings-values-changed', newVal);
});
</script>
