/** @type {import('tailwindcss').Config} */
import colors from 'tailwindcss/colors'
import daisyui from 'daisyui'

export default {
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
  plugins: [daisyui],
  daisyui: {
    base: false,
    themes: true,
    // themes: [
    //   {
    //     mytheme: {
    //       "primary": "#6f57d8",
    //       "secondary": "#f6d860",
    //       "accent": "#8467ff",
    //       "neutral": "#3d4451",
    //       "base-100": "#181818",
    //       "base-200": "#1f1f1f",
    //       "base-300": "#333333",
    //       "base-content": "#ffffff",
    //       "info": "#2094f3",

    //       "--rounded-box": "1rem", // border radius rounded-box utility class, used in card and other large boxes
    //       "--rounded-btn": "0.5rem", // border radius rounded-btn utility class, used in buttons and similar element
    //       "--rounded-badge": "1.9rem", // border radius rounded-badge utility class, used in badges and similar
    //       "--animation-btn": "0.25s", // duration of animation when you click on button
    //       "--animation-input": "0.2s", // duration of animation for inputs like checkbox, toggle, radio, etc
    //       "--btn-text-case": "uppercase", // set default text transform for buttons
    //       "--btn-focus-scale": "0.95", // scale transform of button when you focus on it
    //       "--border-btn": "1px", // border width of buttons
    //       "--tab-border": "1px", // border width of tabs
    //       "--tab-radius": "0.5rem", // border radius of tabs
    //     },
    //   },
    // ],
  },
}
