/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        police: {
          50: "#e7f0ff",
          100: "#c2d6ff",
          200: "#9dbdff",
          300: "#709bff",
          400: "#457bff",
          500: "#245fd8", // 公安蓝主色
          600: "#1848a8",
          700: "#10357d",
          800: "#0a2455",
          900: "#05132e",
        },
      },
      backgroundImage: {
        "police-gradient":
          "linear-gradient(135deg, #245fd8 0%, #1848a8 40%, #0a2455 100%)",
      },
      boxShadow: {
        "elevated": "0 18px 45px rgba(0,0,0,0.35)",
      },
      borderRadius: {
        xl: "1rem",
      },
    },
  },
  plugins: [],
};
