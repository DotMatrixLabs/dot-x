<template>
  <div class="w-full flex flex-col md:flex-row max-w-sm md:max-w-lg m-auto">
    <label class="cursor-pointer label mx-2 w-full">
      <span class="label-text">{{ label }}</span>
      <button :class="buttonClass" class="btn btn-md" @click="$emit('apply', valueToSend)">{{ buttonTitle }}</button>
    </label>
  </div>
</template>

<script>
export default {

  props: {
    label: {
      type: String,
      default: 'Click'
    },
    valueToSend: {
      
    }, 
    buttonTitle: {
      type: String,
      default: 'Click'
    },
    buttonType: {
      type: String,
      default: '' // primary, secondary, accent, ghost, error, warning, success
    }
  },

  computed: {
    buttonClass() {
      console.log(this.buttonType)
      switch (this.buttonType) {
        case 'delete':
          return 'ring ring-red-500 ring-3 btn-outline text-red-300 hover:bg-red-500 hover:text-white hover:ring-0'
          break;
        default:
          return `btn-${this.buttonType}`;
      }
    }
  },

  emits: ['apply'],

}
</script>

<style lang="scss" scoped></style>