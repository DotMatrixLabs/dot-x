<template>
  <div class="w-full flex flex-col md:flex-row max-w-sm md:max-w-lg m-auto">
    <label class="label mx-2 w-full">
      <span class="label-text">{{ label }}</span>
    </label>
    <select @change="emitValue" v-model="inputValue" class="select select-bordered w-full ml-0 md:ml-5">
      <template v-for="number in numbers" :key="number">
        <option class="px-2 text-xl cursor-pointer rounded-lg w-24 h-8" :value="number">{{ number }}{{unit}}</option>
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
    value: {
      type: String,
      default: ''
    },
    max: {
      type: Number,
      default: 100
    },
    min: {
      type: Number,
      default: 30
    },
    step: {
      type: Number,
      default: 5
    },
    unit: {
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
      inputValue: this.value,
      numbers: this.generateNumbers(this.max, this.min, this.step)
    }
  },

  methods: {
    emitValue() {
      if(this.inputValue == 'Pick one') this.inputValue = this.options[0];
      this.$emit('apply', this.inputValue)
    },

    generateNumbers(max = 100, min = 30, step = 5) {
      return Array.from({ 
        length: Math.floor((max - min) / step) + 1 
      }, (_, index) => min + (index * step));
    }
  },
}
</script>
  
<style scoped>

select {
  max-height: 2rem; /* Adjust this value as needed */
  overflow-y: auto;
}

</style>