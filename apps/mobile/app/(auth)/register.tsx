import { router } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { supabase } from "@/services/supabase";

type Form = {
  email: string;
  password: string;
  displayName: string;
};

export default function RegisterScreen() {
  const { control, handleSubmit, formState } = useForm<Form>({ defaultValues: { email: "", password: "", displayName: "" } });

  async function submit(values: Form) {
    const { data, error } = await supabase.auth.signUp({ email: values.email, password: values.password });
    if (error) throw error;
    if (data.user) {
      await supabase.from("profiles").insert({ id: data.user.id, display_name: values.displayName });
    }
    router.replace("/(tabs)/feed");
  }

  return (
    <Screen>
      <View className="mt-12 gap-6">
        <View>
          <Text className="text-3xl font-bold text-ink">Entra nella piazza</Text>
          <Text className="mt-2 text-base leading-6 text-muted">Profilo essenziale, nessun follower, solo luoghi condivisi.</Text>
        </View>
        <View className="gap-3">
          <Controller control={control} name="displayName" render={({ field }) => (
            <TextInput placeholder="Nome pubblico" className="min-h-12 rounded-card border border-border px-3 text-ink" value={field.value} onChangeText={field.onChange} />
          )} />
          <Controller control={control} name="email" render={({ field }) => (
            <TextInput autoCapitalize="none" keyboardType="email-address" placeholder="Email" className="min-h-12 rounded-card border border-border px-3 text-ink" value={field.value} onChangeText={field.onChange} />
          )} />
          <Controller control={control} name="password" render={({ field }) => (
            <TextInput secureTextEntry placeholder="Password" className="min-h-12 rounded-card border border-border px-3 text-ink" value={field.value} onChangeText={field.onChange} />
          )} />
          <Button label="Registrati" onPress={handleSubmit(submit)} disabled={formState.isSubmitting} />
        </View>
      </View>
    </Screen>
  );
}

