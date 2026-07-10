import type { PostCategory, PostTtlMinutes } from "@paraggi/domain";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { demoMode } from "@/config/env";
import { callFunction } from "@/services/api";
import { sendLocalNotification } from "@/services/notifications";
import { useAppStore } from "@/stores/appStore";

type Form = {
  category: PostCategory;
  body: string;
  ttlMinutes: PostTtlMinutes;
};

const categoryLabels: Record<PostCategory, string> = {
  question: "Domanda",
  information: "Informazione",
  lost_item: "Oggetto smarrito",
  help: "Aiuto",
  event: "Evento",
  social: "Social",
  emergency: "Emergenza"
};

export default function ComposePostScreen() {
  const addDemoPost = useAppStore((state) => state.addDemoPost);
  const [includeImage, setIncludeImage] = useState(false);
  const [includeVideo, setIncludeVideo] = useState(false);
  const [includeAudio, setIncludeAudio] = useState(false);
  const [shareApproxLocation, setShareApproxLocation] = useState(false);
  const { control, handleSubmit, setValue, watch, formState } = useForm<Form>({
    defaultValues: { category: "question", body: "", ttlMinutes: 180 }
  });
  const selectedTtl = watch("ttlMinutes");
  const selectedCategory = watch("category");

  async function submit(values: Form) {
    if (demoMode) {
      const post = addDemoPost(values);
      await sendLocalNotification("Nuovo post vicino", `${post.display_name}: ${post.body}`);
      router.replace("/(tabs)/feed");
      return;
    }

    const attachments: Array<Record<string, unknown>> = [];
    if (shareApproxLocation) {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === "granted") {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        attachments.push({
          kind: "location",
          label: "Posizione condivisa dall'autore",
          latitude: current.coords.latitude,
          longitude: current.coords.longitude
        });
      }
    }

    await callFunction("create-post", { body: { ...values, attachments } });
    router.replace("/(tabs)/feed");
  }

  return (
    <Screen>
      <View className="mt-4 gap-5">
        <View>
          <Text className="text-2xl font-bold text-ink">Nuovo post locale</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">Sara visibile solo a persone vicine e scadra automaticamente.</Text>
        </View>
        <Controller control={control} name="body" render={({ field }) => (
          <TextInput
            multiline
            textAlignVertical="top"
            placeholder="Cosa vuoi chiedere o condividere qui?"
            className="min-h-36 rounded-card border border-border p-3 text-base text-ink"
            value={field.value}
            onChangeText={field.onChange}
          />
        )} />
        <View className="gap-2">
          <Text className="font-semibold text-ink">Categoria</Text>
          <View className="flex-row flex-wrap gap-2">
            {(["question", "information", "lost_item", "help", "event", "social", "emergency"] as PostCategory[]).map((category) => (
              <Button key={category} label={categoryLabels[category]} variant={selectedCategory === category ? "primary" : "secondary"} onPress={() => setValue("category", category)} />
            ))}
          </View>
        </View>
        <View className="gap-2">
          <Text className="font-semibold text-ink">Scadenza</Text>
          <View className="flex-row gap-2">
            {([30, 180, 1440] as PostTtlMinutes[]).map((ttl) => (
              <Button key={ttl} label={ttl === 30 ? "30 min" : ttl === 180 ? "3 ore" : "24 ore"} variant={selectedTtl === ttl ? "primary" : "secondary"} onPress={() => setValue("ttlMinutes", ttl)} />
            ))}
          </View>
        </View>
        <View className="gap-3 rounded-card border border-border bg-surface p-4">
          <View>
            <Text className="font-semibold text-ink">Allegati e posizione</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Per ora media test in demo. La posizione puo essere condivisa come allegato volontario.</Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            <Button label={includeImage ? "Immagine aggiunta" : "Aggiungi immagine"} variant={includeImage ? "primary" : "secondary"} onPress={() => setIncludeImage((value) => !value)} />
            <Button label={includeVideo ? "Video aggiunto" : "Aggiungi video"} variant={includeVideo ? "primary" : "secondary"} onPress={() => setIncludeVideo((value) => !value)} />
            <Button label={includeAudio ? "Audio aggiunto" : "Aggiungi audio"} variant={includeAudio ? "primary" : "secondary"} onPress={() => setIncludeAudio((value) => !value)} />
            <Button label={shareApproxLocation ? "GPS nel post attivo" : "Condividi GPS"} variant={shareApproxLocation ? "primary" : "secondary"} onPress={() => setShareApproxLocation((value) => !value)} />
          </View>
          {(includeImage || includeVideo || includeAudio || shareApproxLocation) ? (
            <Text className="text-sm leading-5 text-muted">
              Allegati selezionati: {[
                includeImage ? "immagine" : null,
                includeVideo ? "video" : null,
                includeAudio ? "audio" : null,
                shareApproxLocation ? "posizione" : null
              ].filter(Boolean).join(", ")}
            </Text>
          ) : null}
        </View>
        <Button label="Pubblica" onPress={handleSubmit(submit)} disabled={formState.isSubmitting} />
      </View>
    </Screen>
  );
}
