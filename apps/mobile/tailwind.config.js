/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#ffffff",
        surface: "#f3f8f8",
        ink: "#17232b",
        muted: "#62717a",
        border: "#d9e2e3",
        primary: "#16808a",
        accent: "#b75b31",
        danger: "#b43d32",
        success: "#21875f"
      },
      borderRadius: {
        card: "8px"
      }
    }
  },
  plugins: []
};
