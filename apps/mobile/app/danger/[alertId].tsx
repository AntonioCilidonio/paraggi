import type { ErrorBoundaryProps } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert, Linking, Platform, Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { callFunction } from "@/services/api";
import { captureClientError } from "@/services/clientLogger";
import { getSafeDangerCoordinates } from "@/services/dangerAlert";
import { getFriendlyError } from "@/services/errors";
import { SafeMapPreview } from "@/components/SafeMapPreview";

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
  moderation_status: "unreviewed" | "confirmed_helpful" | "false_alarm";
  viewer_is_author: boolean;
  viewer_feedback: "helpful" | "false_alarm" | null;
  helpful_count: number;
  false_alarm_count: number;
};

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const loggedMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (loggedMessageRef.current === error.message) return;
    loggedMessageRef.current = error.message;
    captureClientError("danger_alert_screen_error", error, {}, "fatal");
  }, [error]);

  return (
    <Screen>
      <View className="mt-4 gap-4">
        <Text className="text-2xl font-bold text-ink">SOS non disponibile</Text>
        <Text className="text-sm leading-5 text-muted">
          La richiesta di aiuto non si e aperta correttamente. Puoi riprovare
          senza chiudere l'app.
        </Text>
        <Button label="Riprova" onPress={retry} />
        <Button label="Torna al feed" variant="secondary" onPress={() => router.replace("/(tabs)/feed")} />
      </View>
    </Screen>
  );
}

export default function DangerAlertScreen() {
  const params = useLocalSearchParams<{ alertId?: string | string[] }>();
  const alertId = Array.isArray(params.alertId) ? params.alertId[0] : params.alertId;
  const alert = useQuery({
    queryKey: ["danger-alert", alertId],
    enabled: Boolean(alertId),
    queryFn: async () => callFunction<{ alert: DangerAlert }>("get-danger-alert", { method: "GET", query: { alertId: alertId ?? "" } })
  });
  const loggedQueryErrorRef = useRef<unknown>(null);

  useEffect(() => {
    if (!alert.isError || loggedQueryErrorRef.current === alert.error) return;
    loggedQueryErrorRef.current = alert.error;
    captureClientError("danger_alert_load_failed", alert.error, { alertId });
  }, [alert.error, alert.isError, alertId]);
  const item = alert.data?.alert;
  const coordinates = getSafeDangerCoordinates(item);

  async function sendFeedback(verdict: "helpful" | "false_alarm") {
    if (!alertId) return;
    try {
      await callFunction("submit-danger-feedback", { body: { alertId, verdict } });
      await alert.refetch();
    } catch (error) {
      Alert.alert("Valutazione non inviata", getFriendlyError(error, "Riprova tra qualche secondo."));
    }
  }

  function confirmFalseAlarm() {
    Alert.alert(
      "Segnalare un falso allarme?",
      "La segnalazione viene conteggiata una sola volta. Servono conferme da piu persone prima di limitare l'account.",
      [
        { text: "Annulla", style: "cancel" },
        { text: "Conferma", style: "destructive", onPress: () => void sendFeedback("false_alarm") }
      ]
    );
  }

  function openNavigation() {
    if (!coordinates) return;
    const label = encodeURIComponent("SOS Paraggi");
    const url = Platform.OS === "ios"
      ? `maps://?q=${label}&ll=${coordinates.latitude},${coordinates.longitude}`
      : `geo:${coordinates.latitude},${coordinates.longitude}?q=${coordinates.latitude},${coordinates.longitude}(${label})`;
    void Linking.openURL(url);
  }

  return (
    <Screen showBottomBar>
      <View className="gap-5">
        <View className="-mx-4 -mt-3 flex-row items-center gap-3 bg-primary-strong px-4 pb-5 pt-4">
          <Pressable accessibilityRole="button" accessibilityLabel="Torna indietro" onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-card border border-white/20 bg-white/10">
            <Ionicons name="arrow-back" size={21} color="#ffffff" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-white">Richiesta di aiuto</Text>
            <Text className="mt-1 text-sm text-white/70">Posizione condivisa per raggiungere l'utente.</Text>
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
            <View className="gap-2 rounded-card bg-category-emergency p-4">
              <View className="flex-row items-center gap-2"><Ionicons name="warning" size={22} color="#b42318" /><Text className="text-lg font-bold text-danger">{item.active ? "SOS attivo" : "SOS concluso"}</Text></View>
              <Text className="text-base leading-6 text-ink">{item.message}</Text>
              <Text className="text-sm text-muted">Inviato da {item.author_name}{item.distance_meters !== null ? ` · a circa ${item.distance_meters} m da te` : ""}</Text>
            </View>

            {coordinates ? (
              <SafeMapPreview latitude={coordinates.latitude} longitude={coordinates.longitude} title="Area della richiesta SOS" description={item.message} danger height={310} />
            ) : (
              <View className="gap-2 rounded-card border border-danger bg-surface p-4">
                <Text className="font-semibold text-danger">Posizione SOS non valida</Text>
                <Text className="text-sm leading-5 text-muted">La richiesta e visibile, ma la posizione ricevuta non puo essere mostrata in sicurezza.</Text>
              </View>
            )}
            <Text className="text-sm leading-5 text-muted">
              {item.share_precise_coordinates ? "L'utente ha scelto di condividere la posizione precisa per questo SOS." : "La mappa mostra soltanto un'area approssimativa per proteggere la posizione dell'utente."}
            </Text>
            <Button label="Apri nel navigatore" icon="navigate" variant="danger" disabled={!coordinates} onPress={openNavigation} />
            {!item.viewer_is_author ? (
              <View className="gap-3 border-t border-border pt-4">
                <View>
                  <Text className="font-semibold text-ink">Questo allarme era reale?</Text>
                  <Text className="mt-1 text-sm leading-5 text-muted">Il tuo riscontro protegge la funzione SOS dagli abusi. Ogni account puo esprimersi una sola volta.</Text>
                </View>
                <View className="flex-row gap-2">
                  <Button
                    className="flex-1"
                    label={item.viewer_feedback === "helpful" ? "Confermato" : "Era reale"}
                    icon="checkmark-circle-outline"
                    disabled={item.viewer_feedback === "helpful"}
                    onPress={() => void sendFeedback("helpful")}
                  />
                  <Button
                    className="flex-1"
                    label={item.viewer_feedback === "false_alarm" ? "Segnalato" : "Falso allarme"}
                    variant="secondary"
                    disabled={item.viewer_feedback === "false_alarm"}
                    onPress={confirmFalseAlarm}
                  />
                </View>
                {(item.helpful_count > 0 || item.false_alarm_count > 0) ? (
                  <Text className="text-xs text-muted">Conferme utili: {item.helpful_count} · segnalazioni: {item.false_alarm_count}</Text>
                ) : null}
                {item.moderation_status === "false_alarm" ? <Text className="text-sm font-semibold text-danger">Allarme chiuso dopo verifiche negative di piu utenti.</Text> : null}
              </View>
            ) : (
              <Text className="border-t border-border pt-4 text-sm text-muted">Gli utenti raggiunti possono confermare l'utilita dell'allarme o segnalare un abuso.</Text>
            )}
          </>
        ) : null}
      </View>
    </Screen>
  );
}
