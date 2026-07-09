import type { PostCategory, PostTtlMinutes } from "@paraggi/domain";
import { router } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { callFunction } from "@/services/api";

type Form = {
  category: PostCategory;
  body: string;
  ttlMinutes: PostTtlMinutes;
};

export default function ComposePostScreen() {
  const { control, handleSubmit, setValue, watch, formState } = useForm<Form>({
    defaultValues: { category: "question", body: "", ttlMinutes: 180 }
  });
  const selectedTtl = watch("ttlMinutes");

  async function submit(values: Form) {
    await callFunction("create-post", { body: values });
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
              <Button key={category} label={category} variant="secondary" onPress={() => setValue("category", category)} />
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
        <Button label="Pubblica" onPress={handleSubmit(submit)} disabled={formState.isSubmitting} />
      </View>
    </Screen>
  );
}

