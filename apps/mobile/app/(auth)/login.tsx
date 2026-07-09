import { Link, router } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { supabase } from "@/services/supabase";

type Form = {
  email: string;
  password: string;
};

export default function LoginScreen() {
  const { control, handleSubmit, formState } = useForm<Form>({ defaultValues: { email: "", password: "" } });

  async function submit(values: Form) {
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) throw error;
    router.replace("/(tabs)/feed");
  }

  return (
    <Screen>
      <View className="mt-12 gap-6">
        <View>
          <Text className="text-3xl font-bold text-ink">Paraggi</Text>
          <Text className="mt-2 text-base leading-6 text-muted">La piazza digitale delle persone vicine.</Text>
        </View>
        <View className="gap-3">
          <Controller control={control} name="email" render={({ field }) => (
            <TextInput autoCapitalize="none" keyboardType="email-address" placeholder="Email" className="min-h-12 rounded-card border border-border px-3 text-ink" value={field.value} onChangeText={field.onChange} />
          )} />
          <Controller control={control} name="password" render={({ field }) => (
            <TextInput secureTextEntry placeholder="Password" className="min-h-12 rounded-card border border-border px-3 text-ink" value={field.value} onChangeText={field.onChange} />
          )} />
          <Button label="Accedi" onPress={handleSubmit(submit)} disabled={formState.isSubmitting} />
        </View>
        <Link href="/(auth)/register" className="text-primary">Crea un account</Link>
      </View>
    </Screen>
  );
}

