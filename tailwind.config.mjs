/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAF7F2',
        ink: '#292524',
        clay: {
          600: '#B45309',
          700: '#9A3412',
        },
      },
    },
  },
  plugins: [],
};
