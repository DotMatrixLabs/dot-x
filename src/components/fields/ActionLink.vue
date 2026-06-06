<template>
  <div class="w-full flex flex-row max-w-lg">
    <div class="label w-full flex flex-row justify-between items-center">
      <div v-if="label" class="flex flex-col">
        <span class="label-text">{{ label }}</span>
        <span v-if="description" class="label-text-alt opacity-60">{{ description }}</span>
      </div>
      <a
        :href="href"
        target="_blank"
        rel="noopener noreferrer"
        class="btn btn-md group gap-2"
      >
        <span class="relative w-4 h-4 flex items-center justify-center">
          <i :class="[icon || 'fas fa-link', 'absolute transition-all duration-200 opacity-100 group-hover:opacity-0']"></i>
          <i class="fas fa-external-link-alt absolute transition-all duration-200 opacity-0 group-hover:opacity-100"></i>
        </span>
        {{ text || href }}
      </a>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    label: { type: String, default: '' },
    description: { type: String, default: '' },
    href: { type: String, default: '' },
    text: { type: String, default: '' },
    icon: { type: String, default: '' },
  },

  emits: ['apply'],
}
</script>

<style lang="scss" scoped></style>
