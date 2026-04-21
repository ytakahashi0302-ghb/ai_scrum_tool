import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          base: colors.slate[50],
          muted: colors.slate[100],
          border: colors.slate[200],
        },
        accent: {
          soft: colors.blue[50],
          muted: colors.blue[100],
          border: colors.blue[200],
        },
      },
      borderRadius: {
        badge: "0.375rem",
        card: "0.75rem",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.07)",
        panel: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
      },
    },
  },
  plugins: [],
}
