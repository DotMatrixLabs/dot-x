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
      fill="#D9D9D9"
      fill-opacity="0.27"
    />
    <g :transform="`translate(0,${sliderPosition})`">
      <rect x="1" y="0" width="34" height="50" rx="5" fill="#D9D9D9" />
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

  computed: {
    sliderPosition() {
      return ((this.sliderVal - 0) * (0 - 300)) / (100 - 0) + 300;
    },
  },

  mounted() {
    console.log("slider");
  },
};
</script>

<style scoped></style>
