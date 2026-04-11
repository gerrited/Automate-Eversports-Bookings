/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#437C72',
          hover: '#528B81',
        },
      },
    },
  },
  plugins: [],
}

