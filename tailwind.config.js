/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors')

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    colors: {
      'primary': '#202124',
      'secondary': '#292A2D',
      'secondaryLight': '#555555',
      'accent': '#CC051C',
      'hover-accent': '#A80316',
      'hover-white': '#D2D2D2',
      transparent: 'transparent',
      gray: colors.gray,
      blue: colors.blue,
      sky: colors.sky,
      red: colors.red,
      green: colors.green,
      indigo: colors.indigo,
      white: colors.white,
      yellow: colors.yellow,
      black: colors.black,
    },
    extend: {},
  },
  plugins: [require("daisyui")],
}
