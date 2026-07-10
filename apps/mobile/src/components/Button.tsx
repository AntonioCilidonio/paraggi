import { Pressable, Text } from "react-native";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  className?: string;
};

export function Button({ label, onPress, variant = "primary", disabled, className = "" }: Props) {
  const variantClassName = variant === "primary"
    ? "bg-primary"
    : variant === "danger"
      ? "bg-danger"
      : "bg-surface border border-border";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      className={`min-h-11 items-center justify-center rounded-card px-4 ${variantClassName} ${className} ${disabled ? "opacity-50" : "opacity-100"}`}
    >
      <Text className={variant === "secondary" ? "font-semibold text-ink" : "font-semibold text-white"}>{label}</Text>
    </Pressable>
  );
}
