/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "oklch(1 0 0)",
        surface: "oklch(0.972 0.006 188)",
        ink: "oklch(0.205 0.018 210)",
        muted: "oklch(0.475 0.025 210)",
        border: "oklch(0.895 0.012 200)",
        primary: "oklch(0.58 0.118 188)",
        accent: "oklch(0.57 0.15 31)",
        danger: "oklch(0.55 0.17 24)",
        success: "oklch(0.56 0.13 154)"
      },
      borderRadius: {
        card: "8px"
      }
    }
  },
  plugins: []
};

