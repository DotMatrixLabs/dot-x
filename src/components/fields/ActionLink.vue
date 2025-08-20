<template>
    <div class="w-full flex flex-col md:flex-row max-w-sm md:max-w-lg m-auto">
      <label class="label mx-2 w-full">
        <span class="label-text ">{{ label }}:</span>
        <a :href="`/${link}`" class="font-bold underline">{{ linklabel || link }}</a>
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
      },
      link: {
        type: String,
        default: ''
      },
      linklabel: {
        type: String,
        default: ''
      },
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