/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        pos: {
          bg: "#0F172A",
          card: "#1E293B",
          border: "#334155",
          primary: "#3B82F6",
        },
      },
    },
  },
  plugins: [],
};
