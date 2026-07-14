import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Image, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function MediaViewScreen() {
  const params = useLocalSearchParams<{ url?: string | string[]; label?: string | string[] }>();
  const url = Array.isArray(params.url) ? params.url[0] : params.url;
  const label = Array.isArray(params.label) ? params.label[0] : params.label;
  const { width, height } = useWindowDimensions();

  return (
    <SafeAreaView className="flex-1 bg-ink">
      <View className="h-14 flex-row items-center gap-3 border-b border-white/20 px-3">
        <Pressable accessibilityRole="button" accessibilityLabel="Chiudi immagine" onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-card bg-white/10">
          <Ionicons name="close" size={25} color="#ffffff" />
        </Pressable>
        <Text className="flex-1 font-semibold text-white" numberOfLines={1}>{label ?? "Immagine del post"}</Text>
      </View>
      {url ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ minHeight: height - 120, alignItems: "center", justifyContent: "center" }}
          centerContent
          maximumZoomScale={4}
          minimumZoomScale={1}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          <Image source={{ uri: url }} resizeMode="contain" style={{ width, height: height - 120 }} accessibilityLabel={label ?? "Immagine del post"} />
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Ionicons name="image-outline" size={38} color="#ffffff" />
          <Text className="text-center text-white">Immagine non disponibile.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
