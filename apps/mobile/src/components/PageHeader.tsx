import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

type Props = {
  title: string;
  subtitle: string;
  action?: ReactNode;
};

export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <View className="flex-1">
        <Text className="text-xl font-semibold text-ink">{title}</Text>
        <Text className="mt-1 text-sm leading-5 text-muted">{subtitle}</Text>
      </View>
      {action}
    </View>
  );
}

export function HeaderIconButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-11 w-11 items-center justify-center rounded-card bg-accent"
    >
      <Ionicons name={icon} size={21} color="#ffffff" />
    </Pressable>
  );
}
