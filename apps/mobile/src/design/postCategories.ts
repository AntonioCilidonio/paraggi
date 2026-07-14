import type { PostCategory } from "@paraggi/domain";
import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

export type PostCategoryTheme = {
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  backgroundClass: string;
  borderClass: string;
  textClass: string;
  iconColor: string;
};

export const postCategoryOrder: PostCategory[] = [
  "question",
  "information",
  "lost_item",
  "help",
  "event",
  "social",
  "emergency"
];

export const postCategoryThemes: Record<PostCategory, PostCategoryTheme> = {
  question: {
    label: "Domanda",
    icon: "help-circle-outline",
    backgroundClass: "bg-primary-soft",
    borderClass: "border-primary",
    textClass: "text-primary-strong",
    iconColor: "#126d75"
  },
  information: {
    label: "Informazione",
    icon: "information-circle-outline",
    backgroundClass: "bg-blue-50",
    borderClass: "border-blue-300",
    textClass: "text-blue-800",
    iconColor: "#1e5f99"
  },
  lost_item: {
    label: "Oggetto smarrito",
    icon: "key-outline",
    backgroundClass: "bg-amber-50",
    borderClass: "border-amber-300",
    textClass: "text-amber-900",
    iconColor: "#8a5a09"
  },
  help: {
    label: "Aiuto",
    icon: "hand-left-outline",
    backgroundClass: "bg-emerald-50",
    borderClass: "border-emerald-300",
    textClass: "text-emerald-800",
    iconColor: "#21734f"
  },
  event: {
    label: "Evento",
    icon: "calendar-outline",
    backgroundClass: "bg-violet-50",
    borderClass: "border-violet-300",
    textClass: "text-violet-800",
    iconColor: "#6542a3"
  },
  social: {
    label: "Socializzazione",
    icon: "people-outline",
    backgroundClass: "bg-rose-50",
    borderClass: "border-rose-300",
    textClass: "text-rose-800",
    iconColor: "#a33d5d"
  },
  emergency: {
    label: "Emergenza",
    icon: "warning-outline",
    backgroundClass: "bg-red-50",
    borderClass: "border-red-300",
    textClass: "text-red-800",
    iconColor: "#b42318"
  }
};

export function getPostCategoryTheme(category: string): PostCategoryTheme {
  return postCategoryThemes[category as PostCategory] ?? postCategoryThemes.information;
}
