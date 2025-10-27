/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors')

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    colors: {
      'primary': '#1a1a1a',
      'secondary': '#292A2D',
      'secondaryLight': '#555555',
      'accent': '#7033d9',
      'hover-accent': '#5a28ad',
      'hover-white': '#D2D2D2',
      'brand-white': '#f9f9fb',
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
    extend: {
      fontFamily: {
        'sans': ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        'heading': ['Poppins', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    base: true,
    themes: [
      {
        light: {
          ...require("daisyui/src/theming/themes")["light"],
          primary: "#7033d9", // DML accent
          secondary: "#292A2D", // DML secondary
          accent: "#7033d9",
          neutral: colors.gray[700],
          "base-100": "#f9f9fb", // DML white
          "base-200": colors.gray[100],
          "base-300": colors.gray[200],
          info: colors.blue[500],
          success: colors.green[500],
          warning: colors.yellow[500],
          error: colors.red[500],
        },
      },
      {
        dark: {
          ...require("daisyui/src/theming/themes")["dark"],
          primary: "#7033d9",
          "primary-content": "#f9f9fb",
          secondary: "#292A2D",
          "secondary-content": "#f9f9fb",
          accent: "#7033d9",
          "accent-content": "#f9f9fb",
          neutral: colors.gray[800],
          "neutral-content": "#f9f9fb",
          "base-100": "#202020", // Mica base color
          "base-200": "#1C1C1C", // layer 1 - cards, buttons, etc.
          "base-300": "#1A1A1A", // layer 2 - deeper cards, etc.
          "base-content": "#f9f9fb",
          info: colors.blue[400],
          success: colors.green[400],
          warning: colors.yellow[400],
          error: colors.red[400],
        },
      },
    ],
  },
}
