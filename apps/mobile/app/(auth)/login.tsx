import { type Href, Link, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { getFriendlyError } from "@/services/errors";
import { resolveNotificationRoute } from "@/services/notificationRouting";
import { supabase } from "@/services/supabase";

type Form = {
  email: string;
  password: string;
};

export default function LoginScreen() {
  const params = useLocalSearchParams<{ next?: string | string[] }>();
  const requestedRoute = Array.isArray(params.next)
    ? params.next[0]
    : params.next;
  const { control, handleSubmit, formState } = useForm<Form>({
    defaultValues: { email: "", password: "" },
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submit(values: Form) {
    setErrorMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email.trim(),
        password: values.password,
      });
      if (error) throw error;
      router.replace(
        resolveNotificationRoute({ deepLink: requestedRoute }) as Href,
      );
    } catch (error) {
      setErrorMessage(
        getFriendlyError(
          error,
          "Accesso non riuscito. Controlla email e password.",
        ),
      );
    }
  }

  return (
    <Screen>
      <View className="gap-6">
        <View className="-mx-4 -mt-3 gap-3 bg-primary-strong px-4 pb-8 pt-12">
          <View className="h-12 w-12 items-center justify-center rounded-card bg-white/15">
            <Text className="text-xl font-bold text-white">P</Text>
          </View>
          <Text className="text-3xl font-bold text-white">Paraggi</Text>
          <Text className="text-base leading-6 text-white/70">
            La piazza digitale delle persone vicine.
          </Text>
        </View>
        <View className="gap-3 rounded-card bg-white p-4">
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="Email"
                className="min-h-12 rounded-card border border-border bg-bg px-3 text-ink"
                value={field.value}
                onChangeText={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <TextInput
                secureTextEntry
                placeholder="Password"
                className="min-h-12 rounded-card border border-border bg-bg px-3 text-ink"
                value={field.value}
                onChangeText={field.onChange}
              />
            )}
          />
          {errorMessage ? (
            <Text className="rounded-card bg-danger/10 p-3 text-sm font-semibold text-danger">
              {errorMessage}
            </Text>
          ) : null}
          <Button
            label="Accedi"
            variant="accent"
            onPress={handleSubmit(submit)}
            disabled={formState.isSubmitting}
          />
        </View>
        <Link href="/(auth)/register" className="text-primary">
          Crea un account
        </Link>
      </View>
    </Screen>
  );
}
