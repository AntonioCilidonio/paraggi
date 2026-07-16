import { Text, View } from "react-native";

type Props = {
  label: string;
  tone?: "neutral" | "success" | "danger" | "warning";
};

export function StatusPill({ label, tone = "neutral" }: Props) {
  const toneClass = tone === "success"
    ? "bg-primary"
    : tone === "danger"
      ? "bg-danger"
      : tone === "warning"
        ? "bg-accent"
        : "bg-surface border border-border";

  return (
    <View className={`self-start rounded-card px-3 py-1 ${toneClass}`}>
      <Text className={tone === "neutral" ? "text-xs font-medium text-muted" : "text-xs font-semibold text-white"}>{label}</Text>
    </View>
  );
}
