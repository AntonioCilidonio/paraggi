import * as Location from "expo-location";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, Vibration, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { demoMode } from "@/config/env";
import { useLocationSync } from "@/hooks/useLocationSync";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import { callFunction } from "@/services/api";
import { sendLocalNotification } from "@/services/notifications";
import { supabase } from "@/services/supabase";
import { useAppStore } from "@/stores/appStore";

function formatTime(value: string | null) {
  if (!value) return "mai";
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function ProfileScreen() {
  const radiusMeters = useAppStore((state) => state.radiusMeters);
  const setRadius = useAppStore((state) => state.setRadius);
  const notificationPermission = useAppStore((state) => state.notificationPermission);
  const locationPermission = useAppStore((state) => state.locationPermission);
  const lastLocationSyncAt = useAppStore((state) => state.lastLocationSyncAt);
  const lastLocationAccuracyMeters = useAppStore((state) => state.lastLocationAccuracyMeters);
  const lastLocationTrustStatus = useAppStore((state) => state.lastLocationTrustStatus);
  const lastLocationError = useAppStore((state) => state.lastLocationError);
  const resetDemoScenario = useAppStore((state) => state.resetDemoScenario);
  const registerPush = usePushRegistration();
  const syncLocation = useLocationSync();
  const [gpsStatus, setGpsStatus] = useState("Premi il bottone per attivare e sincronizzare il GPS.");
  const [shareDangerCoordinates, setShareDangerCoordinates] = useState(true);
  const [dangerStatus, setDangerStatus] = useState("Allarme non inviato");

  async function requestGps() {
    setGpsStatus("Sincronizzo GPS...");
    const result = await syncLocation();
    setGpsStatus(result.ok ? "GPS attivo e sincronizzato. Ora puoi pubblicare post e testare le chat." : "GPS non sincronizzato. Controlla permessi, rete e posizione.");
  }

  async function triggerDangerAlert() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setDangerStatus("GPS negato: impossibile inviare SOS");
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const latitude = current.coords.latitude;
      const longitude = current.coords.longitude;
      const message = "SOS Paraggi: una persona vicina chiede aiuto";
      const body = shareDangerCoordinates
        ? `${message}. Coordinate: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
        : `${message}. Coordinate precise non condivise.`;

      Vibration.vibrate([0, 500, 180, 500]);

      if (demoMode) {
        await sendLocalNotification("Allarme pericolo vicino", body);
        setDangerStatus("SOS demo inviato ai vicini simulati");
        return;
      }

      const result = await callFunction<{ recipientCount: number }>("trigger-danger-alert", {
        body: {
          latitude,
          longitude,
          accuracyMeters: current.coords.accuracy ?? undefined,
          radiusMeters,
          message,
          sharePreciseCoordinates: shareDangerCoordinates
        }
      });
      setDangerStatus(`SOS inviato a ${result.recipientCount} utenti vicini`);
    } catch {
      setDangerStatus("SOS non inviato: GPS o rete non disponibili");
    }
  }

  function confirmDangerAlert() {
    Alert.alert(
      "Inviare SOS?",
      shareDangerCoordinates
        ? "Invierai una notifica urgente agli utenti vicini con le tue coordinate precise."
        : "Invierai una notifica urgente agli utenti vicini senza coordinate precise.",
      [
        { text: "Annulla", style: "cancel" },
        { text: "Invia SOS", style: "destructive", onPress: () => void triggerDangerAlert() }
      ]
    );
  }

  return (
    <Screen>
      <View className="mt-4 gap-5">
        <View>
          <Text className="text-2xl font-bold text-ink">Profilo</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">Identita leggera, privacy forte, nessun grafo sociale permanente.</Text>
        </View>
        <View className="gap-2">
          <Text className="font-semibold text-ink">Raggio ricerca</Text>
          <View className="flex-row flex-wrap gap-2">
            {[100, 500, 1000, 5000].map((radius) => (
              <Button key={radius} label={radius >= 1000 ? `${radius / 1000} km` : `${radius} m`} variant={radiusMeters === radius ? "primary" : "secondary"} onPress={() => setRadius(radius as 100 | 500 | 1000 | 5000)} />
            ))}
          </View>
        </View>
        <View className="gap-3 rounded-card border border-border bg-surface p-4">
          <Text className="font-semibold text-ink">GPS e permessi</Text>
          <View className="gap-1 rounded-card bg-bg p-3">
            <Text className="text-sm font-semibold text-ink">Stato GPS: {locationPermission === "granted" ? "attivo" : locationPermission === "denied" ? "negato" : "non ancora richiesto"}</Text>
            <Text className="text-sm leading-5 text-muted">Ultimo sync: {formatTime(lastLocationSyncAt)}</Text>
            <Text className="text-sm leading-5 text-muted">Precisione: {lastLocationAccuracyMeters ? `${Math.round(lastLocationAccuracyMeters)} m` : "non disponibile"}</Text>
            <Text className="text-sm leading-5 text-muted">Affidabilita: {lastLocationTrustStatus ?? "non calcolata"}</Text>
            {lastLocationError ? <Text className="text-sm font-semibold text-danger">Errore: {lastLocationError}</Text> : null}
          </View>
          <Text className="text-sm leading-5 text-muted">{gpsStatus}</Text>
          <Button label="Sincronizza GPS ora" variant="secondary" onPress={() => void requestGps()} />
          <Text className="text-sm leading-5 text-muted">Notifiche: {notificationPermission}</Text>
          <Button label="Attiva notifiche" variant="secondary" onPress={() => void registerPush()} />
          <Button label="Invia notifica test" onPress={() => void sendLocalNotification("Paraggi test", "Questa e una notifica locale dell'APK di prova.")} />
          <Button label="Reset scenario demo" variant="secondary" onPress={() => resetDemoScenario()} />
        </View>
        <View className="gap-3 rounded-card border border-danger bg-surface p-4">
          <View>
            <Text className="font-semibold text-danger">Pericolo</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Invia un allarme agli utenti vicini. Le coordinate precise partono solo se il consenso qui sotto e attivo.</Text>
          </View>
          <Button
            label={shareDangerCoordinates ? "Coordinate SOS attive" : "Coordinate SOS disattive"}
            variant={shareDangerCoordinates ? "danger" : "secondary"}
            onPress={() => setShareDangerCoordinates((value) => !value)}
          />
          <Button label="Invia SOS vicino" variant="danger" onPress={confirmDangerAlert} />
          <Text className="text-sm leading-5 text-muted">{dangerStatus}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push("/settings/privacy")} className="rounded-card border border-border bg-surface p-4">
          <Text className="font-semibold text-ink">Privacy e dati</Text>
          <Text className="mt-1 text-sm text-muted">Export, eliminazione account e consensi.</Text>
        </Pressable>
        <Button
          label="Esci"
          variant="secondary"
          onPress={() => {
            if (demoMode) {
              resetDemoScenario();
              return;
            }
            void supabase.auth.signOut().then(() => router.replace("/(auth)/login"));
          }}
        />
      </View>
    </Screen>
  );
}
