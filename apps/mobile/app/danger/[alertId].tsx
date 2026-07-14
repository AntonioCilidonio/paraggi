import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { callFunction } from "@/services/api";
import { getFriendlyError } from "@/services/errors";

type DangerAlert = {
  id: string;
  author_name: string;
  message: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  radius_meters: number;
  distance_meters: number | null;
  share_precise_coordinates: boolean;
  active: boolean;
  created_at: string;
};

export default function DangerAlertScreen() {
  const params = useLocalSearchParams<{ alertId?: string | string[] }>();
  const alertId = Array.isArray(params.alertId) ? params.alertId[0] : params.alertId;
  const alert = useQuery({
    queryKey: ["danger-alert", alertId],
    enabled: Boolean(alertId),
    queryFn: async () => callFunction<{ alert: DangerAlert }>("get-danger-alert", { method: "GET", query: { alertId: alertId ?? "" } })
  });
  const item = alert.data?.alert;

  function openNavigation() {
    if (!item) return;
    const label = encodeURIComponent("SOS Paraggi");
    const url = Platform.OS === "ios"
      ? `maps://?q=${label}&ll=${item.latitude},${item.longitude}`
      : `geo:${item.latitude},${item.longitude}?q=${item.latitude},${item.longitude}(${label})`;
    void Linking.openURL(url);
  }

  return (
    <Screen>
      <View className="gap-5">
        <View className="flex-row items-center gap-3 border-b border-border pb-4">
          <Pressable accessibilityRole="button" accessibilityLabel="Torna indietro" onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-card border border-border bg-white">
            <Ionicons name="arrow-back" size={21} color="#17232b" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-ink">Richiesta di aiuto</Text>
            <Text className="mt-1 text-sm text-muted">Posizione condivisa per raggiungere l'utente.</Text>
          </View>
        </View>

        {alert.isLoading ? <Text className="text-muted">Cerco l'SOS vicino...</Text> : null}
        {alert.isError ? (
          <View className="gap-3 rounded-card border border-danger bg-surface p-4">
            <Text className="font-semibold text-danger">SOS non disponibile</Text>
            <Text className="text-sm leading-5 text-muted">{getFriendlyError(alert.error, "L'allarme potrebbe essere terminato o fuori dal tuo raggio.")}</Text>
            <Button label="Riprova" variant="secondary" onPress={() => void alert.refetch()} />
          </View>
        ) : null}

        {item ? (
          <>
            <View className="gap-2 rounded-card border border-danger bg-white p-4">
              <View className="flex-row items-center gap-2"><Ionicons name="warning" size={22} color="#b42318" /><Text className="text-lg font-bold text-danger">SOS attivo</Text></View>
              <Text className="text-base leading-6 text-ink">{item.message}</Text>
              <Text className="text-sm text-muted">Inviato da {item.author_name}{item.distance_meters !== null ? ` · a circa ${item.distance_meters} m da te` : ""}</Text>
            </View>

            <View className="overflow-hidden rounded-card border border-border bg-surface" style={{ height: 310 }}>
              <MapView
                style={{ flex: 1 }}
                initialRegion={{ latitude: item.latitude, longitude: item.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
                showsUserLocation
                showsMyLocationButton
              >
                <Marker coordinate={{ latitude: item.latitude, longitude: item.longitude }} title="SOS Paraggi" description={item.message} pinColor="#b42318" />
              </MapView>
            </View>
            <Text className="text-sm leading-5 text-muted">
              {item.share_precise_coordinates ? "L'utente ha scelto di condividere la posizione precisa per questo SOS." : "La mappa mostra soltanto un'area approssimativa per proteggere la posizione dell'utente."}
            </Text>
            <Button label="Apri nel navigatore" icon="navigate" variant="danger" onPress={openNavigation} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}
