/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#eef6ff",
        surface: "#f7faff",
        "surface-raised": "#ffffff",
        ink: "#1a2027",
        muted: "#7f8791",
        border: "#cbd8e5",
        primary: "#3b82c4",
        "primary-strong": "#3b82c4",
        "primary-soft": "#dcecff",
        accent: "#8b6de9",
        danger: "#b84037",
        success: "#4caf78",
        warning: "#96650d",
        info: "#2f6f9f",
        "category-question": "#b99be8",
        "category-question-surface": "#e7ddf7",
        "category-question-ink": "#4c2878",
        "category-information": "#91a5e8",
        "category-information-surface": "#dce3f8",
        "category-information-ink": "#293f78",
        "category-lost": "#78c7e8",
        "category-lost-surface": "#d7f0fa",
        "category-lost-ink": "#18566f",
        "category-help": "#8fd19e",
        "category-help-surface": "#d9f0df",
        "category-help-ink": "#245d34",
        "category-event": "#f2d45c",
        "category-event-surface": "#faf0b8",
        "category-event-ink": "#655000",
        "category-social": "#f3a35c",
        "category-social-surface": "#f9dfc7",
        "category-social-ink": "#743b0d",
        "category-emergency": "#e98787",
        "category-emergency-surface": "#f7d3d3",
        "category-emergency-ink": "#7d2424"
      },
      borderRadius: {
        card: "8px"
      }
    }
  },
  plugins: []
};
