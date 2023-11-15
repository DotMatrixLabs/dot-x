<template>
  <svg
    width="40"
    height="100%"
    viewBox="0 0 35 350"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="6.05322"
      y="0.0852051"
      width="23.7288"
      height="349.343"
      rx="11.8644"
      fill="#727272"
      :fill-opacity="colorScheme === 'dark' ? 0.3 : 0.5"
    />
    <g :transform="`translate(0,${sliderPosition})`">
      <rect x="1" y="0" width="34" height="50" rx="5" style="fill:rgb(255, 255, 255);stroke-width:1.5;stroke:rgba(141, 141, 141, 0.512)"  fill="#f2f2f2" />
      <line x1="1.2" y1="16" x2="35" y2="16" stroke="black" />
      <line x1="1.2" y1="25" x2="35" y2="25" stroke="black" />
      <line x1="1.2" y1="34" x2="35" y2="34" stroke="black" />
    </g>
  </svg>
</template>

<script>
export default {
  props: {
    sliderVal: {
      type: Number,
      default: 0,
    },
  },

  data() {
    return {
      colorScheme: "",
    };
  },

  computed: {
    sliderPosition() {
      return ((this.sliderVal - 0) * (0 - 300)) / (100 - 0) + 300;
    },
  },

  mounted() {
    console.log("slider");
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
