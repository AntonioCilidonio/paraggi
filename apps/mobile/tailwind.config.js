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
        "category-question": "#c7ddf5",
        "category-question-surface": "#dceafa",
        "category-question-ink": "#285b87",
        "category-information": "#d9cff2",
        "category-information-surface": "#e5ddf2",
        "category-information-ink": "#564187",
        "category-lost": "#f4dc62",
        "category-lost-surface": "#fbf1b8",
        "category-lost-ink": "#5e4a00",
        "category-help": "#bdddcf",
        "category-help-surface": "#d5eae6",
        "category-help-ink": "#275b48",
        "category-event": "#d6dce3",
        "category-event-surface": "#e8ecf0",
        "category-event-ink": "#3f4852",
        "category-social": "#edc6dc",
        "category-social-surface": "#f2ddeb",
        "category-social-ink": "#7d405f",
        "category-emergency": "#f2b7b0",
        "category-emergency-surface": "#f6d5d1",
        "category-emergency-ink": "#9b3027"
      },
      borderRadius: {
        card: "8px"
      }
    }
  },
  plugins: []
};
