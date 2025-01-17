<template>
    <div class="w-full flex flex-col md:flex-row max-w-sm md:max-w-lg m-auto">
      <label class="label w-full mx-2">
        <span class="label-text ">{{ label }}:</span>
        <span class="font-bold">{{ value ?? 'N/A' }}</span>
      </label>
    </div>
  </template>
  
  <script>
  export default {
    props: {
      label: {
        type: String,
        default: ''
      },
      value: {
        type: String
      }
    },
  
    watch: {
      value(newValue) {
              this.newValue = newValue;
          }
    },
  
  
  
    emits: ['apply'],
  
    data() {
      return {
        newValue: this.value
      }
    },
  
  
  
  }
  </script>
  
  <style lang="scss" scoped></style>