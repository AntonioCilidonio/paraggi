import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
  icon?: ComponentProps<typeof Ionicons>["name"];
  className?: string;
};

export function Button({ label, onPress, variant = "primary", disabled, loading = false, icon, className = "" }: Props) {
  const variantClassName = variant === "primary"
    ? "bg-primary"
    : variant === "danger"
      ? "bg-danger"
      : "bg-surface border border-border";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={disabled || loading ? undefined : onPress}
      className={`min-h-11 items-center justify-center rounded-card px-4 ${variantClassName} ${className} ${disabled ? "opacity-50" : "opacity-100"}`}
    >
      <View className="flex-row items-center justify-center gap-2">
        {loading ? <ActivityIndicator size="small" color={variant === "secondary" ? "#17232b" : "#ffffff"} /> : null}
        {!loading && icon ? <Ionicons name={icon} size={18} color={variant === "secondary" ? "#17232b" : "#ffffff"} /> : null}
        <Text className={variant === "secondary" ? "font-semibold text-ink" : "font-semibold text-white"}>{label}</Text>
      </View>
    </Pressable>
  );
}
