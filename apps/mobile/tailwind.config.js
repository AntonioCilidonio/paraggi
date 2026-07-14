/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#ffffff",
        surface: "#f3f8f8",
        "surface-raised": "#ffffff",
        ink: "#17232b",
        muted: "#62717a",
        border: "#d9e2e3",
        primary: "#16808a",
        "primary-strong": "#126d75",
        "primary-soft": "#e4f4f3",
        accent: "#b75b31",
        danger: "#b43d32",
        success: "#21875f",
        warning: "#a46708",
        info: "#2d6ea3"
      },
      borderRadius: {
        card: "8px"
      }
    }
  },
  plugins: []
};
