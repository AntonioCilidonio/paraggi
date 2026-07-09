import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { demoMode } from "@/config/env";
import { callFunction } from "@/services/api";
import { sendLocalNotification } from "@/services/notifications";

export default function PrivacyScreen() {
  async function exportData() {
    if (demoMode) {
      await sendLocalNotification("Export dati pronto", "Demo: il file dati utente sarebbe generato dal backend GDPR.");
      return;
    }
    await callFunction("export-account-data", { method: "GET" });
  }

  async function deleteAccount() {
    if (demoMode) {
      await sendLocalNotification("Eliminazione simulata", "Demo: account e dati sarebbero eliminati dal backend.");
      return;
    }
    await callFunction("delete-account", { method: "DELETE" });
  }

  return (
    <Screen>
      <View className="mt-4 gap-4">
        <View>
          <Text className="text-2xl font-bold text-ink">Privacy e dati</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">Coordinate precise mai mostrate. Puoi esportare o eliminare i dati.</Text>
        </View>
        <View className="rounded-card border border-border bg-surface p-4">
          <Text className="font-semibold text-ink">Consensi</Text>
          <Text className="mt-2 text-sm leading-5 text-muted">Posizione usata solo per prossimita, mai mostrata come coordinate. Notifiche revocabili dal sistema operativo.</Text>
        </View>
        <Button label="Esporta dati" variant="secondary" onPress={() => void exportData()} />
        <Button label="Elimina account" variant="danger" onPress={() => void deleteAccount()} />
      </View>
    </Screen>
  );
}
