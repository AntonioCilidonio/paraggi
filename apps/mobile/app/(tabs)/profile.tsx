import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { demoMode } from "@/config/env";
import { useLocationSync } from "@/hooks/useLocationSync";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import { sendLocalNotification } from "@/services/notifications";
import { supabase } from "@/services/supabase";
import { useAppStore } from "@/stores/appStore";

export default function ProfileScreen() {
  const radiusMeters = useAppStore((state) => state.radiusMeters);
  const setRadius = useAppStore((state) => state.setRadius);
  const notificationPermission = useAppStore((state) => state.notificationPermission);
  const locationPermission = useAppStore((state) => state.locationPermission);
  const resetDemoScenario = useAppStore((state) => state.resetDemoScenario);
  const registerPush = usePushRegistration();
  const syncLocation = useLocationSync();
  const [gpsStatus, setGpsStatus] = useState("Non ancora sincronizzato");

  async function requestGps() {
    const result = await syncLocation();
    setGpsStatus(result.ok ? "GPS attivo: area demo aggiornata" : "GPS negato o non disponibile");
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
          <Text className="font-semibold text-ink">Permessi e test APK</Text>
          <Text className="text-sm leading-5 text-muted">GPS: {locationPermission} · notifiche: {notificationPermission}</Text>
          <Text className="text-sm leading-5 text-muted">{gpsStatus}</Text>
          <Button label="Attiva GPS" variant="secondary" onPress={() => void requestGps()} />
          <Button label="Attiva notifiche" variant="secondary" onPress={() => void registerPush()} />
          <Button label="Invia notifica test" onPress={() => void sendLocalNotification("Paraggi test", "Questa e una notifica locale dell'APK di prova.")} />
          <Button label="Reset scenario demo" variant="secondary" onPress={() => resetDemoScenario()} />
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
