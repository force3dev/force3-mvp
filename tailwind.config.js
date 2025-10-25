/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {theme: {
  extend: {
    colors: {
      "force-black": "#0B0C10",
      "force-gray": "#1F2833",
      "force-silver": "#C5C6C7",
      "force-teal": "#66FCF1",
      "force-blue": "#45A29E",
      "force-white": "#FFFFFF",
    },
    fontFamily: {
      heading: ["var(--font-grotesk)", "sans-serif"],
      body: ["var(--font-manrope)", "sans-serif"],
    },
  },
},
},
  },
  plugins: [],
}
