import { Ionicons } from "@expo/vector-icons";
import { Platform, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

type Props = {
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  danger?: boolean;
  height?: number;
};

export function SafeMapPreview({ latitude, longitude, title, description, danger = false, height = 220 }: Props) {
  if (Platform.OS === "ios") {
    return (
      <View className="overflow-hidden rounded-card border border-border" style={{ height }}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={{ latitude, longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
          scrollEnabled={false}
          zoomEnabled={false}
        >
          <Marker coordinate={{ latitude, longitude }} title={title} description={description} pinColor={danger ? "#b84037" : "#3b82c4"} />
        </MapView>
      </View>
    );
  }

  return (
    <View className="relative overflow-hidden rounded-card border border-border bg-primary-soft" style={{ height }}>
      <View className="absolute left-[-30px] top-12 h-0.5 w-[460px] rotate-12 bg-white/80" />
      <View className="absolute left-[-40px] top-40 h-0.5 w-[460px] -rotate-12 bg-white/80" />
      <View className="absolute left-24 top-[-40px] h-[420px] w-0.5 rotate-12 bg-white/80" />
      <View className="flex-1 items-center justify-center gap-2">
        <View className={`h-14 w-14 items-center justify-center rounded-full ${danger ? "bg-danger" : "bg-primary"}`}>
          <Ionicons name={danger ? "warning" : "location"} size={28} color="#ffffff" />
        </View>
        <Text className="font-semibold text-ink">{title}</Text>
        {description ? <Text className="max-w-64 text-center text-xs leading-4 text-muted" numberOfLines={2}>{description}</Text> : null}
      </View>
    </View>
  );
}
