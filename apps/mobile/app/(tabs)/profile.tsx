import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Switch, Text, Vibration, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { demoMode } from "@/config/env";
import { useLocationSync } from "@/hooks/useLocationSync";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import { callFunction } from "@/services/api";
import { getFriendlyError } from "@/services/errors";
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
  lastE2e?: {
    created_at: string;
    metadata?: { checks?: string[]; pushTokenReady?: boolean };
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
  const [scenarioStatus, setScenarioStatus] = useState("Self-test non eseguito.");
  const [showTestTools, setShowTestTools] = useState(false);

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
      setPushStatus(result.demo ? "Notifiche locali attive." : "Notifiche push attive su questo dispositivo.");
      return;
    }
    if (result?.reason === "permission_denied") {
      setPushStatus("Permesso negato. Puoi abilitarlo dalle impostazioni Android.");
    } else if (result?.reason === "native_push_not_configured") {
      setPushStatus("Avvisi locali attivi. Il push remoto richiede la configurazione FCM nella build Android.");
    } else {
      setPushStatus("Avvisi locali attivi, ma il push remoto non e stato registrato. Riprova con una rete stabile.");
    }
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

  async function runTestScenario() {
    if (demoMode) {
      setScenarioStatus("Self-test demo non necessario: usa Supabase per validare il backend reale.");
      return;
    }

    setScenarioStatus("Creo scenario backend...");
    try {
      setScenarioStatus("Sincronizzo GPS per il self-test...");
      const locationResult = await syncLocation();
      if (!locationResult.ok) {
        setScenarioStatus(locationResult.message ?? "GPS non sincronizzato. Abilita i permessi e riprova.");
        return;
      }

      setScenarioStatus("Creo scenario backend...");
      const result = await callFunction<{
        passed: boolean;
        checks: Array<{ name: string; status: "passed" }>;
        post: { id: string };
        chat: { id: string };
        messages: unknown[];
        notifications: { currentUser: number; testUser: number; remotePushReady: boolean };
      }>("run-test-scenario", {
        body: locationResult.coordinates
      });
      setScenarioStatus(`E2E superato: ${result.checks.length} controlli, chat ${result.chat.id.slice(0, 8)}, ${result.messages.length} messaggi, push ${result.notifications.remotePushReady ? "pronto" : "senza token"}.`);
      await sendLocalNotification("Self-test completato", "Post, commento, richiesta, chat e messaggi sono stati creati.");
      await loadDiagnostics();
    } catch (error) {
      setScenarioStatus(getFriendlyError(error, "Self-test non riuscito. Sincronizza GPS e riprova."));
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
      <View className="mt-4 gap-6">
        <View>
          <Text className="text-2xl font-bold text-ink">Profilo e preferenze</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">Controlla raggio, permessi e sicurezza da un solo posto.</Text>
        </View>

        <View className="gap-3">
          <Text className="font-semibold text-ink">Raggio dei post</Text>
          <Text className="text-sm leading-5 text-muted">Le chat mantengono il proprio limite di vicinanza. Questa scelta cambia il feed e la mappa.</Text>
          <View className="flex-row flex-wrap gap-2">
            {[100, 500, 1000, 5000, 30000, 60000].map((radius) => (
              <Button key={radius} label={radius >= 1000 ? `${radius / 1000} km` : `${radius} m`} variant={radiusMeters === radius ? "primary" : "secondary"} onPress={() => setRadius(radius as 100 | 500 | 1000 | 5000 | 30000 | 60000)} />
            ))}
          </View>
        </View>

        <View className="gap-4 border-t border-border pt-5">
          <Text className="font-semibold text-ink">Permessi</Text>
          <View className="flex-row items-start gap-3">
            <Ionicons name={locationPermission === "granted" ? "location" : "location-outline"} size={22} color={locationPermission === "granted" ? "#16808a" : "#62717a"} />
            <View className="flex-1">
              <Text className="font-semibold text-ink">Posizione {locationPermission === "granted" ? "attiva" : locationPermission === "denied" ? "negata" : "da attivare"}</Text>
              <Text className="mt-1 text-sm leading-5 text-muted">{lastLocationSyncAt ? `Aggiornata alle ${formatTime(lastLocationSyncAt)} · precisione ${lastLocationAccuracyMeters ? `${Math.round(lastLocationAccuracyMeters)} m` : "n/d"}` : gpsStatus}</Text>
              {lastLocationTrustStatus ? <Text className="mt-1 text-xs text-muted">Affidabilita posizione: {lastLocationTrustStatus}</Text> : null}
              {lastLocationError ? <Text className="mt-1 text-sm font-semibold text-danger">{getFriendlyError(lastLocationError)}</Text> : null}
            </View>
          </View>
          <Button label="Aggiorna posizione" icon="navigate-outline" variant="secondary" onPress={() => void requestGps()} />

          <View className="flex-row items-start gap-3 border-t border-border pt-4">
            <Ionicons name={notificationPermission === "granted" ? "notifications" : "notifications-outline"} size={22} color={notificationPermission === "granted" ? "#16808a" : "#62717a"} />
            <View className="flex-1">
              <Text className="font-semibold text-ink">Notifiche {notificationPermission === "granted" ? "consentite" : "da attivare"}</Text>
              <Text className="mt-1 text-sm leading-5 text-muted">{pushStatus}</Text>
            </View>
          </View>
          <Button label="Attiva notifiche" icon="notifications-outline" variant="secondary" onPress={() => void activatePushNotifications()} />
          <Button label="Prova un avviso sul telefono" icon="phone-portrait-outline" onPress={() => void sendLocalNotification("Paraggi test", "Le notifiche locali funzionano su questo dispositivo.")} />
        </View>

        <View className="gap-4 border-t border-border pt-5">
          <View>
            <Text className="font-semibold text-danger">SOS di vicinanza</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Avvisa le persone nel raggio. Confermerai sempre prima dell'invio.</Text>
          </View>
          <View className="flex-row items-center justify-between gap-4">
            <View className="flex-1">
              <Text className="font-semibold text-ink">Condividi coordinate nell'SOS</Text>
              <Text className="mt-1 text-sm leading-5 text-muted">Disattiva per inviare solo l'area approssimativa.</Text>
            </View>
            <Switch value={shareDangerCoordinates} onValueChange={setShareDangerCoordinates} trackColor={{ false: "#d9e2e3", true: "#8bc7c8" }} thumbColor={shareDangerCoordinates ? "#16808a" : "#62717a"} />
          </View>
          <Button label="Invia SOS vicino" icon="warning-outline" variant="danger" onPress={confirmDangerAlert} />
          {dangerStatus !== "Allarme non inviato" ? <Text className="text-sm leading-5 text-muted">{dangerStatus}</Text> : null}
        </View>

        <Pressable accessibilityRole="button" onPress={() => router.push("/settings/privacy")} className="flex-row items-center gap-3 border-t border-border pt-5">
          <Ionicons name="shield-checkmark-outline" size={22} color="#16808a" />
          <View className="flex-1">
            <Text className="font-semibold text-ink">Privacy e dati</Text>
            <Text className="mt-1 text-sm text-muted">Consensi, esportazione ed eliminazione account.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#62717a" />
        </Pressable>

        <View className="border-t border-border pt-5">
          <Pressable accessibilityRole="button" onPress={() => setShowTestTools((value) => !value)} className="flex-row items-center justify-between py-2">
            <View className="flex-row items-center gap-3">
              <Ionicons name="flask-outline" size={22} color="#62717a" />
              <Text className="font-semibold text-ink">Strumenti di test</Text>
            </View>
            <Ionicons name={showTestTools ? "chevron-up" : "chevron-down"} size={20} color="#62717a" />
          </Pressable>
          {showTestTools ? (
            <View className="mt-3 gap-3">
              <Text className="text-sm leading-5 text-muted">{diagnosticsStatus}</Text>
              {diagnostics ? (
                <View className="gap-1 border-y border-border py-3">
                  <Text className="text-sm text-ink">Profilo/GPS: {yesNo(diagnostics.readiness.hasProfile)}/{yesNo(diagnostics.readiness.hasRecentLocation)}</Text>
                  <Text className="text-sm text-ink">Token push: {diagnostics.counts.enabledPushTokens}</Text>
                  <Text className="text-sm text-ink">Post/commenti: {diagnostics.counts.ownPosts}/{diagnostics.counts.ownComments}</Text>
                  <Text className="text-sm text-ink">Chat/messaggi: {diagnostics.counts.chats}/{diagnostics.counts.sentMessages}</Text>
                  <Text className="text-sm text-muted">Errori recenti: {diagnostics.recentErrors.length}</Text>
                </View>
              ) : null}
              <Button label="Controlla diagnostica" icon="pulse-outline" variant="secondary" onPress={() => void loadDiagnostics()} />
              <Text className="text-sm leading-5 text-muted">{scenarioStatus}</Text>
              <Button label="Esegui test completo" icon="checkmark-done-outline" onPress={() => void runTestScenario()} />
              {demoMode ? <Button label="Ripristina dati demo" variant="secondary" onPress={() => resetDemoScenario()} /> : null}
            </View>
          ) : null}
        </View>

        <Button label="Esci" icon="log-out-outline" variant="secondary" onPress={() => {
          if (demoMode) {
            resetDemoScenario();
            return;
          }
          void supabase.auth.signOut().then(() => router.replace("/(auth)/login"));
        }} />
      </View>
    </Screen>
  );
}
