<template>
  <svg
    width="40"
    height="100%"
    viewBox="0 0 35 350"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="glassBorderDark" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#dddddd" />
        <stop offset="33%" stop-color="#555555" />
        <stop offset="62%" stop-color="#555555" />
        <stop offset="100%" stop-color="#555555" />
      </linearGradient>
      <linearGradient id="glassBorderLight" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#8a8a8a" />
        <stop offset="33%" stop-color="#7a7a7a" />
        <stop offset="62%" stop-color="#5e5e5e" />
        <stop offset="100%" stop-color="#7a7a7a" />
      </linearGradient>
    </defs>
    <rect
      x="6.05322"
      y="0.0852051"
      width="23.7288"
      height="349.343"
      rx="11.8644"
      :fill="colorScheme === 'dark' ? '#ffffff' : '#000000'"
      :fill-opacity="colorScheme === 'dark' ? 0.06 : 0.06"
      :stroke="colorScheme === 'dark' ? 'url(#glassBorderDark)' : 'url(#glassBorderLight)'"
      stroke-width="2"
      :stroke-opacity="colorScheme === 'dark' ? 0.7 : 0.5"
    />
    <g :transform="`translate(0,${sliderPosition})`">
      <rect x="1" y="0" width="34" height="50" rx="5" :style="rectStyle"  fill="#f2f2f2" />
      <line x1="1.2" y1="16" x2="35" y2="16" stroke="black" />
      <line x1="1.2" y1="25" x2="35" y2="25" stroke="black" />
      <line x1="1.2" y1="34" x2="35" y2="34" stroke="black" />
    </g>
  </svg>
</template>

<script>
import { watch, ref } from "vue";
export default {
  props: {
    sliderVal: {
      type: Number,
      default: 0,
    },
    midiEnabled: {
      type: Boolean,
      default: false,
    },
    midiEnabledGlobal: {
      type: Boolean,
      default: false,
    }
  },
  
  watch: {
    midiEnabled(state) {
      this.updateMidiEnabled(state);
    },
    midiEnabledGlobal(state) {
      this.updateMidiEnabledGlobal(state);
    },
  },

  data() {
    return {
      colorScheme: "",
      rectStyle: "",
    };
  },

  computed: {
    sliderPosition() {
      return ((this.sliderVal - 0) * (0 - 300)) / (100 - 0) + 300;
    },
  },
  methods: {
    updateMidiEnabled(state) {
      if (state && this.midiEnabledGlobal) {
        this.rectStyle = "fill:rgb(0, 255, 0);stroke-width:1.5;stroke:rgba(141, 141, 141, 0.512)";
      } else {
        this.rectStyle = "fill:rgb(255, 255, 255);stroke-width:1.5;stroke:rgba(141, 141, 141, 0.512)";
      }
    },
    updateMidiEnabledGlobal(state) {
      this.updateMidiEnabled(this.midiEnabled);
    },
  },

  mounted() {
    this.updateMidiEnabled(this.midiEnabled);
    this.updateMidiEnabledGlobal(this.midiEnabledGlobal);
    this.colorScheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      this.colorScheme = event.matches ? "dark" : "light";
    });
  },
};
</script>

<style scoped></style>
