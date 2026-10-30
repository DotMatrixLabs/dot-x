<template>
  <div class="form-control w-64 mb-4">
    <label class="label">
      <span class="label-text">{{ label }}</span>
    </label>
    <select @change="emitValue" v-model="inputValue" class="select select-bordered">
      <option disabled selected>Pick one</option>
      <template v-for="option in timezones" :key="option">
        <option class="px-2 text-xl cursor-pointer rounded-lg">{{ option }}</option>
      </template>
    </select>
  </div>
</template>

<script>
import { getTimezones } from '../../ts/timezones';

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
      inputValue: this.value,
      timezones: getTimezones()
    }
  },

  methods: {
    emitValue() {
      if (this.inputValue == 'Pick one') this.inputValue = this.timezones[0];
      this.$emit('apply', this.inputValue)
    }
  },
}
</script>

<style lang="scss" scoped></style>
