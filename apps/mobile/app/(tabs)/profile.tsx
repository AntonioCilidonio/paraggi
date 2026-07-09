import { Link, router } from "expo-router";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import { sendLocalNotification } from "@/services/notifications";
import { supabase } from "@/services/supabase";
import { useAppStore } from "@/stores/appStore";

export default function ProfileScreen() {
  const radiusMeters = useAppStore((state) => state.radiusMeters);
  const setRadius = useAppStore((state) => state.setRadius);
  const notificationPermission = useAppStore((state) => state.notificationPermission);
  const locationPermission = useAppStore((state) => state.locationPermission);
  const setLocationPermission = useAppStore((state) => state.setLocationPermission);
  const resetDemoScenario = useAppStore((state) => state.resetDemoScenario);
  const registerPush = usePushRegistration();

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
          <Button label="Simula GPS concesso" variant="secondary" onPress={() => setLocationPermission("granted")} />
          <Button label="Attiva notifiche" variant="secondary" onPress={() => void registerPush()} />
          <Button label="Invia notifica test" onPress={() => void sendLocalNotification("Paraggi test", "Questa e una notifica locale dell'APK di prova.")} />
          <Button label="Reset scenario demo" variant="secondary" onPress={() => resetDemoScenario()} />
        </View>
        <Link href="/settings/privacy" className="rounded-card border border-border bg-surface p-4 font-semibold text-ink">Privacy e dati</Link>
        <Button label="Esci" variant="secondary" onPress={() => void supabase.auth.signOut().then(() => router.replace("/(auth)/login"))} />
      </View>
    </Screen>
  );
}
