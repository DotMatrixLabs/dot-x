<template>
  <div class="w-full flex flex-row max-w-lg m-auto">
    <label class="label mx-2 w-full">
      <span class="label-text">{{ label }}</span>
    </label>
    <select @change="emitValue" v-model="inputValue" class="select select-bordered w-full ml-0">
      <option disabled selected>Pick one</option>
      <template v-for="option in options" :key="option">
        <option class="px-2 text-xl cursor-pointer rounded-lg">{{ option }}</option>
      </template>
    </select>
  </div>
</template>
  
<script>
export default {
  props: {
    label: {
      type: String,
      default: 'Toggle'
    },
    placeholder: {
      type: String,
      default: 'Type here'
    },
    options: {
      type: Array,
      default: ['No selections available']
    },
    value: {
      type: String,
      default: ''
    }
  },

  emits: ['apply'],

  watch: {
    value(newValue) {
      this.inputValue = newValue;
    }
  },


  data() {
    return {
      inputValue: this.value
    }
  },

  methods: {
    emitValue() {
      if(this.inputValue == 'Pick one') this.inputValue = this.options[0];
      this.$emit('apply', this.inputValue)
    }
  },
}
</script>
  
<style lang="scss" scoped></style>