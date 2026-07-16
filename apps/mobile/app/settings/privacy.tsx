import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Share, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { demoMode } from "@/config/env";
import { callFunction } from "@/services/api";
import { getFriendlyError } from "@/services/errors";
import { supabase } from "@/services/supabase";
import { useAppStore } from "@/stores/appStore";

export default function PrivacyScreen() {
  const locationPermission = useAppStore((state) => state.locationPermission);
  const notificationPermission = useAppStore((state) => state.notificationPermission);
  const [pendingAction, setPendingAction] = useState<"export" | "delete" | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function exportData() {
    setPendingAction("export");
    setStatus(null);
    try {
      const data = demoMode
        ? { exportedAt: new Date().toISOString(), profile: { display_name: "Utente demo" }, posts: [], comments: [], areaHistory: [] }
        : await callFunction<Record<string, unknown>>("export-account-data", { method: "GET" });
      await Share.share({ title: "Esportazione dati Paraggi", message: JSON.stringify(data, null, 2) });
      setStatus("Esportazione preparata correttamente.");
    } catch (error) {
      setStatus(getFriendlyError(error, "Esportazione non riuscita. Riprova."));
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteAccount() {
    setPendingAction("delete");
    setStatus(null);
    try {
      if (!demoMode) await callFunction("delete-account", { method: "DELETE" });
      await supabase.auth.signOut();
      router.replace("/(auth)/login");
    } catch (error) {
      setStatus(getFriendlyError(error, "Account non eliminato. Riprova."));
      setPendingAction(null);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Eliminare definitivamente l'account?",
      "Post, commenti, chat e cronologia personale verranno rimossi. Questa operazione non puo essere annullata.",
      [
        { text: "Annulla", style: "cancel" },
        { text: "Elimina account", style: "destructive", onPress: () => void deleteAccount() }
      ]
    );
  }

  return (
    <Screen>
      <View className="gap-6">
        <View className="-mx-4 -mt-3 flex-row items-center gap-3 bg-primary-strong px-4 pb-5 pt-4">
          <Pressable accessibilityRole="button" accessibilityLabel="Torna al profilo" onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-card border border-white/20 bg-white/10">
            <Ionicons name="arrow-back" size={21} color="#ffffff" />
          </Pressable>
          <View className="flex-1"><Text className="text-2xl font-bold text-white">Privacy e dati</Text><Text className="mt-1 text-sm leading-5 text-white/70">Controlla consensi e dati del tuo account.</Text></View>
        </View>

        <View className="gap-4 rounded-card bg-white p-4">
          <Text className="text-lg font-bold text-ink">Consensi del dispositivo</Text>
          <View className="flex-row items-center gap-3 border-b border-border pb-4">
            <Ionicons name="navigate-outline" size={22} color="#3b82c4" />
            <View className="flex-1"><Text className="font-semibold text-ink">Posizione</Text><Text className="mt-1 text-sm text-muted">{locationPermission === "granted" ? "Consentita. Usata per prossimita e mai mostrata nel feed." : "Non consentita su questo dispositivo."}</Text></View>
          </View>
          <View className="flex-row items-center gap-3 border-b border-border pb-4">
            <Ionicons name="notifications-outline" size={22} color="#3b82c4" />
            <View className="flex-1"><Text className="font-semibold text-ink">Notifiche</Text><Text className="mt-1 text-sm text-muted">{notificationPermission === "granted" ? "Consentite su questo dispositivo." : "Non consentite su questo dispositivo."}</Text></View>
          </View>
        </View>

        <View className="gap-3 rounded-card bg-white p-4">
          <Text className="text-lg font-bold text-ink">I tuoi dati</Text>
          <Text className="text-sm leading-5 text-muted">L'esportazione include profilo, post, commenti, richieste private, chat e cronologia delle aree.</Text>
          <Button label="Esporta e condividi dati" icon="download-outline" variant="secondary" loading={pendingAction === "export"} disabled={pendingAction !== null} onPress={() => void exportData()} />
        </View>

        <View className="gap-3 rounded-card bg-category-emergency p-4">
          <Text className="text-lg font-bold text-danger">Eliminazione account</Text>
          <Text className="text-sm leading-5 text-muted">L'eliminazione e definitiva e chiude immediatamente la sessione.</Text>
          <Button label="Elimina account" icon="trash-outline" variant="danger" loading={pendingAction === "delete"} disabled={pendingAction !== null} onPress={confirmDelete} />
        </View>

        {status ? <Text className="rounded-card bg-surface p-3 text-sm font-semibold text-ink">{status}</Text> : null}
      </View>
    </Screen>
  );
}
