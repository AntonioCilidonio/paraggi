import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { getPostCategoryTheme } from "@/design/postCategories";

export function PostCategoryPill({ category }: { category: string }) {
  const theme = getPostCategoryTheme(category);

  return (
    <View className={`flex-row items-center gap-1 rounded-card px-2.5 py-1.5 ${theme.backgroundClass}`}>
      <Ionicons name={theme.icon} size={14} color={theme.iconColor} />
      <Text className={`text-xs font-medium ${theme.textClass}`}>{theme.label}</Text>
    </View>
  );
}
