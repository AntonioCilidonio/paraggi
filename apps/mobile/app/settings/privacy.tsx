import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { callFunction } from "@/services/api";

export default function PrivacyScreen() {
  return (
    <Screen>
      <View className="mt-4 gap-4">
        <View>
          <Text className="text-2xl font-bold text-ink">Privacy e dati</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">Coordinate precise mai mostrate. Puoi esportare o eliminare i dati.</Text>
        </View>
        <Button label="Esporta dati" variant="secondary" onPress={() => void callFunction("export-account-data", { method: "GET" })} />
        <Button label="Elimina account" variant="danger" onPress={() => void callFunction("delete-account", { method: "DELETE" })} />
      </View>
    </Screen>
  );
}

