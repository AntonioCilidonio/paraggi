import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { getPostCategoryTheme } from "@/design/postCategories";

export function PostCategoryPill({ category }: { category: string }) {
  const theme = getPostCategoryTheme(category);

  return (
    <View className={`flex-row items-center gap-1 rounded-full border px-2.5 py-1.5 ${theme.backgroundClass} ${theme.borderClass}`}>
      <Ionicons name={theme.icon} size={14} color={theme.iconColor} />
      <Text className={`text-xs font-semibold ${theme.textClass}`}>{theme.label}</Text>
    </View>
  );
}
