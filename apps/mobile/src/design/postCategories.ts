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
  surfaceClass: string;
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
    backgroundClass: "bg-category-question",
    borderClass: "border-category-question",
    textClass: "text-category-question-ink",
    iconColor: "#285b87",
    surfaceClass: "bg-category-question-surface"
  },
  information: {
    label: "Informazione",
    icon: "information-circle-outline",
    backgroundClass: "bg-category-information",
    borderClass: "border-category-information",
    textClass: "text-category-information-ink",
    iconColor: "#564187",
    surfaceClass: "bg-category-information-surface"
  },
  lost_item: {
    label: "Oggetto smarrito",
    icon: "key-outline",
    backgroundClass: "bg-category-lost",
    borderClass: "border-category-lost",
    textClass: "text-category-lost-ink",
    iconColor: "#7a4b00",
    surfaceClass: "bg-category-lost-surface"
  },
  help: {
    label: "Aiuto",
    icon: "hand-left-outline",
    backgroundClass: "bg-category-help",
    borderClass: "border-category-help",
    textClass: "text-category-help-ink",
    iconColor: "#275b48",
    surfaceClass: "bg-category-help-surface"
  },
  event: {
    label: "Evento",
    icon: "calendar-outline",
    backgroundClass: "bg-category-event",
    borderClass: "border-category-event",
    textClass: "text-category-event-ink",
    iconColor: "#7d4316",
    surfaceClass: "bg-category-event-surface"
  },
  social: {
    label: "Socializzazione",
    icon: "people-outline",
    backgroundClass: "bg-category-social",
    borderClass: "border-category-social",
    textClass: "text-category-social-ink",
    iconColor: "#7d405f",
    surfaceClass: "bg-category-social-surface"
  },
  emergency: {
    label: "Emergenza",
    icon: "warning-outline",
    backgroundClass: "bg-category-emergency",
    borderClass: "border-category-emergency",
    textClass: "text-category-emergency-ink",
    iconColor: "#9b3027",
    surfaceClass: "bg-category-emergency-surface"
  }
};

export function getPostCategoryTheme(category: string): PostCategoryTheme {
  return postCategoryThemes[category as PostCategory] ?? postCategoryThemes.information;
}
