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

type TestDiagnostics = {
  readiness: {
    hasProfile: boolean;
    hasRecentLocation: boolean;
    hasPushToken: boolean;
    canTestFeed: boolean;
    canReceiveRemotePush: boolean;
    canUseRealtimeNotifications: boolean;
  };
  counts: {
    enabledPushTokens: number;
    ownPosts: number;
    ownComments: number;
    pendingIncomingRequests: number;
    outgoingRequests: number;
    chats: number;
    sentMessages: number;
    unreadNotifications: number;
  };
  latestLocation?: {
    captured_at: string;
    accuracy_meters: number;
    trust_status: string;
    trust_score: number;
  } | null;
  recentErrors: Array<{
    created_at: string;
    source: string;
    message: string;
  }>;
};

function formatTime(value: string | null) {
  if (!value) return "mai";
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function yesNo(value: boolean) {
  return value ? "ok" : "no";
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
  const [pushStatus, setPushStatus] = useState("Premi il bottone per registrare questo dispositivo alle notifiche push.");
  const [shareDangerCoordinates, setShareDangerCoordinates] = useState(true);
  const [dangerStatus, setDangerStatus] = useState("Allarme non inviato");
  const [diagnostics, setDiagnostics] = useState<TestDiagnostics | null>(null);
  const [diagnosticsStatus, setDiagnosticsStatus] = useState("Non ancora controllata.");

  async function requestGps() {
    setGpsStatus("Sincronizzo GPS...");
    const result = await syncLocation();
    setGpsStatus(result.ok ? "GPS attivo e sincronizzato. Ora puoi pubblicare post e testare le chat." : result.message ?? "GPS non sincronizzato. Controlla permessi, rete e posizione.");
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

  async function activatePushNotifications() {
    setPushStatus("Registro il dispositivo...");
    const result = await registerPush();
    if (result?.ok) {
      setPushStatus(result.demo ? "Notifiche demo attive." : `Notifiche push attive. Token: ${result.tokenPreview}...`);
      return;
    }
    setPushStatus(result?.reason === "permission_denied" ? "Permesso notifiche negato dal telefono." : "Token push non registrato. Controlla rete, login e permessi.");
  }

  async function loadDiagnostics() {
    if (demoMode) {
      setDiagnosticsStatus("Diagnostica demo: usa Supabase per i test reali.");
      return;
    }

    setDiagnosticsStatus("Controllo backend...");
    try {
      const result = await callFunction<TestDiagnostics>("get-test-diagnostics", { method: "GET" });
      setDiagnostics(result);
      setDiagnosticsStatus("Diagnostica aggiornata.");
    } catch {
      setDiagnosticsStatus("Diagnostica non disponibile. Controlla login e rete.");
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
            {[100, 500, 1000, 5000, 30000, 60000].map((radius) => (
              <Button key={radius} label={radius >= 1000 ? `${radius / 1000} km` : `${radius} m`} variant={radiusMeters === radius ? "primary" : "secondary"} onPress={() => setRadius(radius as 100 | 500 | 1000 | 5000 | 30000 | 60000)} />
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
          <Text className="text-sm leading-5 text-muted">{pushStatus}</Text>
          <Button label="Attiva notifiche" variant="secondary" onPress={() => void activatePushNotifications()} />
          <Button label="Invia notifica test" onPress={() => void sendLocalNotification("Paraggi test", "Questa e una notifica locale dell'APK di prova.")} />
          <Button label="Reset scenario demo" variant="secondary" onPress={() => resetDemoScenario()} />
        </View>
        <View className="gap-3 rounded-card border border-border bg-surface p-4">
          <Text className="font-semibold text-ink">Diagnostica test</Text>
          <Text className="text-sm leading-5 text-muted">{diagnosticsStatus}</Text>
          {diagnostics ? (
            <View className="gap-1 rounded-card bg-bg p-3">
              <Text className="text-sm text-ink">Profilo: {yesNo(diagnostics.readiness.hasProfile)}</Text>
              <Text className="text-sm text-ink">GPS backend: {yesNo(diagnostics.readiness.hasRecentLocation)}</Text>
              <Text className="text-sm text-ink">Token push: {diagnostics.counts.enabledPushTokens}</Text>
              <Text className="text-sm text-ink">Realtime notifiche: {yesNo(diagnostics.readiness.canUseRealtimeNotifications)}</Text>
              <Text className="text-sm text-ink">Post/commenti: {diagnostics.counts.ownPosts}/{diagnostics.counts.ownComments}</Text>
              <Text className="text-sm text-ink">Richieste in arrivo: {diagnostics.counts.pendingIncomingRequests}</Text>
              <Text className="text-sm text-ink">Chat/messaggi: {diagnostics.counts.chats}/{diagnostics.counts.sentMessages}</Text>
              <Text className="text-sm text-ink">Notifiche non lette: {diagnostics.counts.unreadNotifications}</Text>
              <Text className="text-sm text-muted">Ultimo GPS: {formatTime(diagnostics.latestLocation?.captured_at ?? null)} · {diagnostics.latestLocation?.trust_status ?? "n/d"}</Text>
              <Text className="text-sm text-muted">Errori recenti: {diagnostics.recentErrors.length}</Text>
            </View>
          ) : null}
          <Button label="Controlla diagnostica" variant="secondary" onPress={() => void loadDiagnostics()} />
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
