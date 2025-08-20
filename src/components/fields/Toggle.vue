<template>
  <div class="w-full flex flex-col md:flex-row max-w-sm md:max-w-lg m-auto">
    <label class="cursor-pointer label w-full">
      <span class="label-text">{{ label }}</span>
      <input @change="emitApply" v-model="inputValue" type="checkbox" class="toggle toggle-accent toggle-sm" />
    </label>
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
      type: Boolean
    }
  },

  watch: {
    value(newValue) {
            this.inputValue = newValue;
        }
  },



  emits: ['apply'],

  data() {
    return {
      inputValue: this.value
    }
  },

  methods: {
    emitApply() {
      this.$emit('apply', this.inputValue)
    }
  },


}
</script>

<style>

.toggle {
    flex-shrink: 0;
    --tglbg: hsl(var(--b1));
    --handleoffset: 1.5rem;
    --handleoffsetcalculator: calc(var(--handleoffset) * -1);
    --togglehandleborder: 0 0;
    height: 1.5rem;
    width: 3rem;
    cursor: pointer;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    border-width: 1px;
    border-color: hsl(var(--bc) / var(--tw-border-opacity));
    --tw-border-opacity: .2;
    background-color: hsl(var(--bc) / var(--tw-bg-opacity));
    --tw-bg-opacity: .5;
    transition-duration: .3s;
    transition-timing-function: cubic-bezier(.4, 0, .2, 1);
    border-radius: var(--rounded-badge, 1.9rem);
    transition: background, box-shadow var(--animation-input, .2s) ease-in-out;
    box-shadow: var(--handleoffsetcalculator) 0 0 2px var(--tglbg) inset, 0 0 0 2px var(--tglbg) inset, var(--togglehandleborder)
}

[dir=rtl] .toggle {
    --handleoffsetcalculator: calc(var(--handleoffset) * 1)
}

.toggle:focus-visible {
    outline-style: solid;
    outline-width: 2px;
    outline-offset: 2px;
    outline-color: hsl(var(--bc) / .2)
}

.toggle:checked,
.toggle[checked=true],
.toggle[aria-checked=true] {
    --handleoffsetcalculator: var(--handleoffset);
    --tw-border-opacity: 1;
    --tw-bg-opacity: 1
}

[dir=rtl] .toggle:checked,
[dir=rtl] .toggle[checked=true],
[dir=rtl] .toggle[aria-checked=true] {
    --handleoffsetcalculator: calc(var(--handleoffset) * -1)
}

.toggle:indeterminate {
    --tw-border-opacity: 1;
    --tw-bg-opacity: 1;
    box-shadow: calc(var(--handleoffset) / 2) 0 0 2px var(--tglbg) inset, calc(var(--handleoffset) / -2) 0 0 2px var(--tglbg) inset, 0 0 0 2px var(--tglbg) inset
}

[dir=rtl] .toggle:indeterminate {
    box-shadow: calc(var(--handleoffset) / 2) 0 0 2px var(--tglbg) inset, calc(var(--handleoffset) / -2) 0 0 2px var(--tglbg) inset, 0 0 0 2px var(--tglbg) inset
}

.toggle-accent:focus-visible {
    outline-color: hsl(var(--a) / 1)
}

.toggle-accent:checked,
.toggle-accent[checked=true],
.toggle-accent[aria-checked=true] {
    border-color: hsl(var(--a) / var(--tw-border-opacity));
    --tw-border-opacity: .1;
    --tw-bg-opacity: 1;
    background-color: hsl(var(--a) / var(--tw-bg-opacity));
    --tw-text-opacity: 1;
    color: hsl(var(--ac) / var(--tw-text-opacity))
}

.toggle:disabled {
    cursor: not-allowed;
    --tw-border-opacity: 1;
    border-color: hsl(var(--bc) / var(--tw-border-opacity));
    background-color: transparent;
    opacity: .3;
    --togglehandleborder: 0 0 0 3px hsl(var(--bc)) inset, var(--handleoffsetcalculator) 0 0 3px hsl(var(--bc)) inset
}
.toggle-lg {
    --handleoffset: 2rem;
    height: 2rem;
    width: 4rem
}

</style>