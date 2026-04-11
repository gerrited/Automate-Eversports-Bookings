/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#004349',
          hover: '#005a62',
        },
        surface: {
          page: '#021214',
          card: '#03191b',
          input: '#052528',
        },
      },
    },
  },
  plugins: [],
}

