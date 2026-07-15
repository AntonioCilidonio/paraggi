import * as Location from "expo-location";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Image, Pressable, Switch, Text, TextInput, Vibration, View } from "react-native";
import { Button } from "@/components/Button";
import { AppHeader } from "@/components/AppHeader";
import { PageHeader } from "@/components/PageHeader";
import { Screen } from "@/components/Screen";
import { demoMode, env } from "@/config/env";
import { useLocationSync } from "@/hooks/useLocationSync";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import { callFunction } from "@/services/api";
import { getAvatarUrl } from "@/services/avatar";
import { captureClientError } from "@/services/clientLogger";
import { getFriendlyError } from "@/services/errors";
import { sendLocalNotification } from "@/services/notifications";
import { supabase } from "@/services/supabase";
import { useAppStore } from "@/stores/appStore";

function formatTime(value: string | null) {
  if (!value) return "mai";
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function reputationLabel(score: number) {
  if (score >= 75) return "Affidabilita alta";
  if (score >= 40) return "Affidabilita consolidata";
  if (score >= 15) return "Affidabilita in crescita";
  return "Nuovo nella piazza";
}

export default function ProfileScreen() {
  const radiusMeters = useAppStore((state) => state.radiusMeters);
  const setRadius = useAppStore((state) => state.setRadius);
  const notificationPermission = useAppStore((state) => state.notificationPermission);
  const pushDeliveryState = useAppStore((state) => state.pushDeliveryState);
  const locationPermission = useAppStore((state) => state.locationPermission);
  const lastLocationSyncAt = useAppStore((state) => state.lastLocationSyncAt);
  const lastLocationAccuracyMeters = useAppStore((state) => state.lastLocationAccuracyMeters);
  const lastLocationTrustStatus = useAppStore((state) => state.lastLocationTrustStatus);
  const lastLocationError = useAppStore((state) => state.lastLocationError);
  const resetDemoScenario = useAppStore((state) => state.resetDemoScenario);
  const registerPush = usePushRegistration();
  const syncLocation = useLocationSync();
  const [gpsStatus, setGpsStatus] = useState("Premi il bottone per attivare e sincronizzare il GPS.");
  const [pushStatus, setPushStatus] = useState("Premi il bottone per registrare questo dispositivo alle notifiche push.");
  const [shareDangerCoordinates, setShareDangerCoordinates] = useState(true);
  const [dangerStatus, setDangerStatus] = useState("Allarme non inviato");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [pickedAvatar, setPickedAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const profileRadiusHydratedRef = useRef(false);
  const profile = useQuery({
    queryKey: ["profile-summary"],
    queryFn: async () => {
      if (demoMode) return { display_name: "Antonio", bio: "Disponibile per informazioni utili nella zona.", avatar_path: null, reputation_score: 100, search_radius_meters: radiusMeters, sos_blocked_until: null, sos_false_alarm_strikes: 0 };
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return { display_name: "Utente Paraggi", bio: "", avatar_path: null, reputation_score: 100, search_radius_meters: radiusMeters, sos_blocked_until: null, sos_false_alarm_strikes: 0 };
      const { data, error } = await supabase.from("profiles").select("display_name,bio,avatar_path,reputation_score,search_radius_meters,sos_blocked_until,sos_false_alarm_strikes").eq("id", auth.user.id).maybeSingle();
      if (error) throw error;
      return data ?? { display_name: auth.user.user_metadata?.display_name ?? "Utente Paraggi", bio: "", avatar_path: null, reputation_score: 100, search_radius_meters: radiusMeters, sos_blocked_until: null, sos_false_alarm_strikes: 0 };
    }
  });

  useEffect(() => {
    if (profileRadiusHydratedRef.current || !profile.data) return;
    profileRadiusHydratedRef.current = true;
    const savedRadius = profile.data?.search_radius_meters;
    if ([100, 500, 1000, 5000, 30000, 60000].includes(savedRadius) && savedRadius !== radiusMeters) {
      setRadius(savedRadius as 100 | 500 | 1000 | 5000 | 30000 | 60000);
    }
  }, [profile.data, radiusMeters, setRadius]);

  useEffect(() => {
    if (!profile.data || isEditingProfile) return;
    setDraftDisplayName(profile.data.display_name ?? "");
    setDraftBio(profile.data.bio ?? "");
  }, [isEditingProfile, profile.data]);

  function startEditingProfile() {
    setDraftDisplayName(profile.data?.display_name ?? "");
    setDraftBio(profile.data?.bio ?? "");
    setPickedAvatar(null);
    setRemoveAvatar(false);
    setProfileStatus(null);
    setIsEditingProfile(true);
  }

  async function pickProfileAvatar() {
    try {
      setProfileStatus(null);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setProfileStatus("Permesso galleria negato. Abilitalo dalle impostazioni del telefono.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        setProfileStatus("La foto supera 5 MB. Scegli un'immagine piu leggera.");
        return;
      }
      setPickedAvatar(asset);
      setRemoveAvatar(false);
    } catch (error) {
      captureClientError("profile_avatar_pick_failed", error);
      setProfileStatus("Foto non selezionata. Riprova.");
    }
  }

  async function saveProfile() {
    const displayName = draftDisplayName.trim();
    const bio = draftBio.trim();
    if (displayName.length < 2 || displayName.length > 40) {
      setProfileStatus("Il nome deve contenere da 2 a 40 caratteri.");
      return;
    }
    if (bio.length > 160) {
      setProfileStatus("La bio puo contenere al massimo 160 caratteri.");
      return;
    }

    setIsSavingProfile(true);
    setProfileStatus("Salvo il profilo...");
    let uploadedPath: string | null = null;
    try {
      if (demoMode) {
        setProfileStatus("Profilo demo aggiornato.");
        setIsEditingProfile(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.user) throw { error: "unauthenticated" };

      let avatarPath = removeAvatar ? null : profile.data?.avatar_path ?? null;
      if (pickedAvatar) {
        const extension = pickedAvatar.mimeType === "image/png" ? "png" : pickedAvatar.mimeType === "image/webp" ? "webp" : "jpg";
        uploadedPath = `${session.user.id}/${Date.now()}.${extension}`;
        const encodedPath = uploadedPath.split("/").map(encodeURIComponent).join("/");
        const response = await FileSystem.uploadAsync(`${env.supabaseUrl}/storage/v1/object/avatars/${encodedPath}`, pickedAvatar.uri, {
          httpMethod: "POST",
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: env.supabaseAnonKey,
            "Content-Type": pickedAvatar.mimeType ?? "image/jpeg",
            "cache-control": "max-age=86400",
            "x-upsert": "false",
          },
        });
        if (response.status < 200 || response.status >= 300) {
          throw new Error(`avatar_upload_failed:${response.status}:${response.body.slice(0, 160)}`);
        }
        avatarPath = uploadedPath;
      }

      const previousAvatar = profile.data?.avatar_path ?? null;
      const { error } = await supabase.from("profiles").update({
        display_name: displayName,
        bio,
        avatar_path: avatarPath,
      }).eq("id", session.user.id);
      if (error) throw error;

      if (previousAvatar && previousAvatar !== avatarPath) {
        await supabase.storage.from("avatars").remove([previousAvatar]);
      }
      await profile.refetch();
      setPickedAvatar(null);
      setRemoveAvatar(false);
      setIsEditingProfile(false);
      setProfileStatus("Profilo aggiornato.");
    } catch (error) {
      if (uploadedPath) await supabase.storage.from("avatars").remove([uploadedPath]);
      captureClientError("profile_update_failed", error, { hasNewAvatar: Boolean(pickedAvatar) });
      setProfileStatus(getFriendlyError(error, "Profilo non aggiornato. Controlla rete e riprova."));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function selectRadius(radius: 100 | 500 | 1000 | 5000 | 30000 | 60000) {
    setRadius(radius);
    if (demoMode) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { error } = await supabase.from("profiles").update({ search_radius_meters: radius }).eq("id", auth.user.id);
    if (!error) await profile.refetch();
  }

  async function requestGps() {
    setGpsStatus("Sincronizzo GPS...");
    const result = await syncLocation();
    setGpsStatus(result.ok ? "GPS attivo e sincronizzato. Post e chat useranno la tua prossimita." : result.message ?? "GPS non sincronizzato. Controlla permessi, rete e posizione.");
  }

  async function triggerDangerAlert() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setDangerStatus("GPS negato: impossibile inviare SOS");
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const latitude = current.coords.latitude;
      const longitude = current.coords.longitude;
      const message = "SOS Paraggi: una persona vicina chiede aiuto";
      const body = shareDangerCoordinates
        ? `${message}. Coordinate: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
        : `${message}. Coordinate precise non condivise.`;

      Vibration.vibrate([0, 500, 180, 500]);

      if (demoMode) {
        await sendLocalNotification("Allarme pericolo vicino", body);
        setDangerStatus("SOS demo inviato ai vicini simulati");
        return;
      }

      const result = await callFunction<{ recipientCount: number }>("trigger-danger-alert", {
        body: {
          latitude,
          longitude,
          accuracyMeters: current.coords.accuracy ?? undefined,
          radiusMeters,
          message,
          sharePreciseCoordinates: shareDangerCoordinates
        }
      });
      setDangerStatus(`SOS inviato a ${result.recipientCount} utenti vicini`);
    } catch (error) {
      const unblockAt = error && typeof error === "object" && "unblockAt" in error ? String((error as { unblockAt?: string }).unblockAt) : null;
      setDangerStatus(unblockAt
        ? `SOS sospeso fino al ${new Date(unblockAt).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}.`
        : getFriendlyError(error, "SOS non inviato: GPS o rete non disponibili."));
    }
  }

  async function activatePushNotifications() {
    setPushStatus("Registro il dispositivo...");
    const result = await registerPush();
    if (result?.ok) {
      setPushStatus(result.demo ? "Notifiche locali attive." : "Notifiche push attive su questo dispositivo.");
      return;
    }
    if (result?.reason === "permission_denied") {
      setPushStatus("Permesso negato. Puoi abilitarlo dalle impostazioni Android.");
    } else if (result?.reason === "native_push_not_configured") {
      setPushStatus("Avvisi locali attivi. Il push remoto richiede la configurazione FCM nella build Android.");
    } else {
      setPushStatus("Avvisi locali attivi, ma il push remoto non e stato registrato. Riprova con una rete stabile.");
    }
  }

  function confirmDangerAlert() {
    Alert.alert(
      "Inviare SOS?",
      shareDangerCoordinates
        ? "Invierai una notifica urgente agli utenti vicini con le tue coordinate precise."
        : "Invierai una notifica urgente agli utenti vicini senza coordinate precise.",
      [
        { text: "Annulla", style: "cancel" },
        { text: "Invia SOS", style: "destructive", onPress: () => void triggerDangerAlert() }
      ]
    );
  }

  const reputationScore = profile.data?.reputation_score ?? 0;
  const sosBlockedUntil = profile.data?.sos_blocked_until ? new Date(profile.data.sos_blocked_until) : null;
  const sosIsBlocked = Boolean(sosBlockedUntil && sosBlockedUntil.getTime() > Date.now());
  const avatarUrl = pickedAvatar?.uri ?? (removeAvatar ? null : getAvatarUrl(profile.data?.avatar_path));

  return (
    <Screen>
      <View className="gap-6">
        <AppHeader />
        <PageHeader title="Profilo" subtitle="Privacy, raggio e sicurezza." action={
          <Pressable accessibilityRole="button" accessibilityLabel={isEditingProfile ? "Annulla modifica profilo" : "Modifica profilo"} onPress={() => isEditingProfile ? setIsEditingProfile(false) : startEditingProfile()} className="h-11 w-11 items-center justify-center rounded-card border border-border bg-white">
            <Ionicons name={isEditingProfile ? "close" : "pencil-outline"} size={20} color="#17232b" />
          </Pressable>
        } />

        <View className="flex-row items-center gap-3">
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} className="h-14 w-14 rounded-full bg-surface" accessibilityLabel="Foto profilo" />
          ) : (
            <View className="h-14 w-14 items-center justify-center rounded-full bg-surface">
              <Text className="text-lg font-bold text-primary">{(profile.data?.display_name ?? "P").slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <View className="flex-1">
            <Text className="text-lg font-bold text-ink">{profile.data?.display_name ?? "Profilo Paraggi"}</Text>
            <View className="mt-1 flex-row items-center gap-1.5">
              <Ionicons name="shield-checkmark-outline" size={15} color="#16808a" />
              <Text className="text-xs font-semibold text-muted">{reputationLabel(reputationScore)} · {reputationScore} punti locali</Text>
            </View>
            {profile.data?.bio ? <Text className="mt-2 text-sm leading-5 text-muted">{profile.data.bio}</Text> : null}
          </View>
        </View>

        {isEditingProfile ? (
          <View className="gap-4 border-y border-border py-5">
            <View className="flex-row flex-wrap gap-2">
              <Button label={pickedAvatar ? "Cambia foto" : "Scegli foto"} icon="camera-outline" variant="secondary" onPress={() => void pickProfileAvatar()} />
              {(profile.data?.avatar_path || pickedAvatar) ? (
                <Button label="Rimuovi foto" icon="trash-outline" variant="secondary" onPress={() => { setPickedAvatar(null); setRemoveAvatar(true); }} />
              ) : null}
            </View>
            <View className="gap-2">
              <Text className="font-semibold text-ink">Nome visibile</Text>
              <TextInput value={draftDisplayName} onChangeText={setDraftDisplayName} maxLength={40} placeholder="Come vuoi apparire nella piazza" className="min-h-12 rounded-card border border-border bg-white px-3 py-3 text-ink" />
            </View>
            <View className="gap-2">
              <View className="flex-row items-center justify-between gap-3">
                <Text className="font-semibold text-ink">Bio</Text>
                <Text className="text-xs text-muted">{draftBio.length}/160</Text>
              </View>
              <TextInput value={draftBio} onChangeText={setDraftBio} maxLength={160} multiline textAlignVertical="top" placeholder="Una breve descrizione utile alle persone vicine" className="min-h-24 rounded-card border border-border bg-white px-3 py-3 text-ink" />
            </View>
            <View className="flex-row gap-2">
              <Button label="Annulla" variant="secondary" className="flex-1" disabled={isSavingProfile} onPress={() => setIsEditingProfile(false)} />
              <Button label={isSavingProfile ? "Salvo..." : "Salva profilo"} icon="checkmark" className="flex-1" loading={isSavingProfile} disabled={isSavingProfile} onPress={() => void saveProfile()} />
            </View>
          </View>
        ) : null}
        {profileStatus ? <Text accessibilityLiveRegion="polite" className="text-sm font-semibold text-primary">{profileStatus}</Text> : null}

        <View className="gap-3">
          <Text className="font-semibold text-ink">Raggio dei post</Text>
          <View className="flex-row flex-wrap gap-2">
            {[100, 500, 1000, 5000, 30000, 60000].map((radius) => (
              <Button key={radius} label={radius >= 1000 ? `${radius / 1000} km` : `${radius} m`} variant={radiusMeters === radius ? "primary" : "secondary"} onPress={() => void selectRadius(radius as 100 | 500 | 1000 | 5000 | 30000 | 60000)} />
            ))}
          </View>
        </View>

        <View className="gap-4 rounded-card border border-border bg-white p-4">
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-card bg-surface"><Ionicons name={locationPermission === "granted" ? "navigate" : "navigate-outline"} size={21} color={locationPermission === "granted" ? "#16808a" : "#62717a"} /></View>
            <View className="flex-1">
              <Text className="font-semibold text-ink">Posizione {locationPermission === "granted" ? "attiva" : locationPermission === "denied" ? "negata" : "da attivare"}</Text>
              <Text className="mt-1 text-sm leading-5 text-muted">{lastLocationSyncAt ? `Aggiornata alle ${formatTime(lastLocationSyncAt)} · precisione ${lastLocationAccuracyMeters ? `${Math.round(lastLocationAccuracyMeters)} m` : "n/d"}` : gpsStatus}</Text>
              {lastLocationTrustStatus ? <Text className="mt-1 text-xs text-muted">Affidabilita posizione: {lastLocationTrustStatus}</Text> : null}
              {lastLocationError ? <Text className="mt-1 text-sm font-semibold text-danger">{getFriendlyError(lastLocationError)}</Text> : null}
            </View>
          </View>
          <Button label="Aggiorna posizione" icon="navigate-outline" variant="secondary" onPress={() => void requestGps()} />

          <View className="flex-row items-start gap-3 border-t border-border pt-4">
            <View className="h-10 w-10 items-center justify-center rounded-card bg-surface"><Ionicons name={notificationPermission === "granted" ? "notifications" : "notifications-outline"} size={21} color={notificationPermission === "granted" ? "#16808a" : "#62717a"} /></View>
            <View className="flex-1">
              <Text className="font-semibold text-ink">Notifiche {notificationPermission === "granted" ? "consentite" : "da attivare"}</Text>
              <Text className="mt-1 text-sm leading-5 text-muted">{
                pushDeliveryState === "registered"
                  ? "Push remoto registrato: gli avvisi possono arrivare anche ad app chiusa."
                  : pushDeliveryState === "local_only"
                    ? "Permesso attivo, ma questa build supporta solo avvisi mentre Paraggi e aperta."
                    : pushDeliveryState === "failed"
                      ? pushStatus
                      : pushStatus
              }</Text>
            </View>
          </View>
          <Button label="Attiva notifiche" icon="notifications-outline" variant="secondary" onPress={() => void activatePushNotifications()} />
        </View>

        <View className="gap-4 rounded-card border border-danger bg-white p-4">
          <View>
            <Text className="font-semibold text-danger">SOS di vicinanza</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Avvisa le persone nel raggio. Gli utenti raggiunti potranno confermare l'allarme o segnalare un abuso.</Text>
          </View>
          <View className="flex-row items-center justify-between gap-4">
            <View className="flex-1">
              <Text className="font-semibold text-ink">Condividi coordinate nell'SOS</Text>
              <Text className="mt-1 text-sm leading-5 text-muted">Disattiva per inviare solo l'area approssimativa.</Text>
            </View>
            <Switch value={shareDangerCoordinates} onValueChange={setShareDangerCoordinates} trackColor={{ false: "#d9e2e3", true: "#8bc7c8" }} thumbColor={shareDangerCoordinates ? "#16808a" : "#62717a"} />
          </View>
          <Button label={sosIsBlocked ? "SOS temporaneamente sospeso" : "Invia SOS vicino"} icon="warning-outline" variant="danger" disabled={sosIsBlocked} onPress={confirmDangerAlert} />
          {sosIsBlocked && sosBlockedUntil ? (
            <Text className="text-sm font-semibold text-danger">Disponibile di nuovo il {sosBlockedUntil.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}.</Text>
          ) : null}
          {dangerStatus !== "Allarme non inviato" ? <Text className="text-sm leading-5 text-muted">{dangerStatus}</Text> : null}
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Apri privacy e dati" onPress={() => router.push("/settings/privacy")} className="flex-row items-center gap-3 rounded-card border border-border bg-white p-4">
          <View className="h-10 w-10 items-center justify-center rounded-card bg-surface"><Ionicons name="shield-checkmark-outline" size={22} color="#16808a" /></View>
          <View className="flex-1">
            <Text className="font-semibold text-ink">Privacy e dati</Text>
            <Text className="mt-1 text-sm text-muted">Consensi, esportazione ed eliminazione account.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#62717a" />
        </Pressable>

        <Button label="Esci" icon="log-out-outline" variant="secondary" onPress={() => {
          if (demoMode) {
            resetDemoScenario();
            return;
          }
          void supabase.auth.signOut().then(() => router.replace("/(auth)/login"));
        }} />
      </View>
    </Screen>
  );
}
