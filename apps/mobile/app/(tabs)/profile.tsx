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
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";
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
  const [showRadiusPicker, setShowRadiusPicker] = useState(false);
  const [showSosControls, setShowSosControls] = useState(false);
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

  function leaveProfile() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/feed");
  }

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
      <View>
        <AppHeader />
        <View className="-mx-4 flex-row items-center gap-3 bg-primary-strong px-4 pb-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Torna alla schermata precedente"
            onPress={leaveProfile}
            className="h-11 w-11 items-center justify-center rounded-card border border-white/20 bg-white/10"
          >
            <Ionicons name="arrow-back" size={21} color="#ffffff" />
          </Pressable>
          <Text className="text-lg font-bold text-white">Profilo</Text>
        </View>
        <View className="-mx-4 flex-row items-center gap-3 bg-primary-strong px-4 pb-5 pt-1">
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} className="h-16 w-16 rounded-full bg-white/15" accessibilityLabel="Foto profilo" />
          ) : (
            <View className="h-16 w-16 items-center justify-center rounded-full bg-white/15">
              <Text className="text-lg font-bold text-white">{(profile.data?.display_name ?? "P").slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <View className="flex-1">
            <Text className="text-lg font-bold text-white">{profile.data?.display_name ?? "Profilo Paraggi"}</Text>
            {profile.data?.bio ? <Text className="mt-1 text-xs leading-5 text-white/70" numberOfLines={2}>{profile.data.bio}</Text> : null}
          </View>
          <View className="items-end">
            <Text className="text-xl font-bold text-white">{reputationScore}</Text>
            <Text className="text-xs text-white/70">Affidabilita</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={isEditingProfile ? "Annulla modifica profilo" : "Modifica profilo"} onPress={() => isEditingProfile ? setIsEditingProfile(false) : startEditingProfile()} className="mt-2 h-9 w-9 items-center justify-center rounded-card border border-white/20 bg-white/10">
              <Ionicons name={isEditingProfile ? "close" : "pencil-outline"} size={17} color="#ffffff" />
            </Pressable>
          </View>
        </View>

        <View className="gap-6 pt-5">
        {isEditingProfile ? (
          <View className="gap-4 rounded-card bg-white p-4">
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

        <View className="overflow-hidden rounded-card bg-white">
          <Pressable accessibilityRole="button" accessibilityLabel="Aggiorna posizione" onPress={() => void requestGps()} className="flex-row items-center gap-3 border-b border-border p-3">
            <Ionicons name="location-outline" size={20} color="#3b82c4" />
            <View className="flex-1">
              <Text className="font-medium text-ink">Posizione</Text>
              <Text className="mt-0.5 text-xs text-muted">{lastLocationSyncAt ? `GPS attivo · aggiornato alle ${formatTime(lastLocationSyncAt)}` : gpsStatus}</Text>
            </View>
            <StatusPill label={locationPermission === "granted" ? "Attivo" : "Attiva"} tone={locationPermission === "granted" ? "success" : "neutral"} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Scegli raggio di ricerca" onPress={() => setShowRadiusPicker((value) => !value)} className="flex-row items-center gap-3 border-b border-border p-3">
            <Ionicons name="scan-outline" size={20} color="#3b82c4" />
            <View className="flex-1"><Text className="font-medium text-ink">Raggio di ricerca</Text><Text className="mt-0.5 text-xs text-muted">Mostra contenuti entro</Text></View>
            <Text className="font-medium text-ink">{radiusMeters >= 1000 ? `${radiusMeters / 1000} km` : `${radiusMeters} m`}</Text>
          </Pressable>
          {showRadiusPicker ? (
            <View className="flex-row flex-wrap gap-2 border-b border-border bg-bg p-3">
              {[100, 500, 1000, 5000, 30000, 60000].map((radius) => (
                <Button key={radius} label={radius >= 1000 ? `${radius / 1000} km` : `${radius} m`} variant={radiusMeters === radius ? "primary" : "secondary"} onPress={() => void selectRadius(radius as 100 | 500 | 1000 | 5000 | 30000 | 60000)} />
              ))}
            </View>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Attiva notifiche" onPress={() => void activatePushNotifications()} className="flex-row items-center gap-3 p-3">
            <Ionicons name="notifications-outline" size={20} color="#3b82c4" />
            <View className="flex-1"><Text className="font-medium text-ink">Notifiche</Text><Text className="mt-0.5 text-xs text-muted">Avvisi e interazioni locali</Text></View>
            <StatusPill
              label={notificationPermission !== "granted"
                ? "Attiva"
                : pushDeliveryState === "registered"
                  ? "Push attive"
                  : "Solo nell'app"}
              tone={pushDeliveryState === "registered" ? "success" : "neutral"}
            />
          </Pressable>
        </View>
        {lastLocationTrustStatus || lastLocationAccuracyMeters || lastLocationError ? <Text className="-mt-4 text-xs text-muted">{lastLocationError ? getFriendlyError(lastLocationError) : `Precisione ${lastLocationAccuracyMeters ? `${Math.round(lastLocationAccuracyMeters)} m` : "n/d"}${lastLocationTrustStatus ? ` · affidabilita ${lastLocationTrustStatus}` : ""}`}</Text> : null}
        {pushDeliveryState === "failed" ? <Text className="-mt-4 text-xs text-danger">{pushStatus}</Text> : null}
        {notificationPermission === "granted" && pushDeliveryState === "local_only" ? (
          <Text className="-mt-4 text-xs text-muted">Avvisi disponibili mentre Paraggi e aperta. Il push remoto richiede Firebase su Android e APNs su iOS.</Text>
        ) : null}

        <View className="overflow-hidden rounded-card bg-white">
          <Pressable accessibilityRole="button" accessibilityLabel="Apri SOS di vicinanza" onPress={() => setShowSosControls((value) => !value)} className="flex-row items-center gap-3 bg-category-emergency-surface p-3">
            <Ionicons name="warning-outline" size={20} color="#963d31" />
            <View className="flex-1"><Text className="font-medium text-ink">SOS di vicinanza</Text><Text className="mt-0.5 text-xs text-muted">Invia una richiesta urgente</Text></View>
            <Ionicons name={showSosControls ? "chevron-up" : "chevron-forward"} size={18} color="#7f8791" />
          </Pressable>
          {showSosControls ? (
            <View className="gap-3 border-t border-border bg-category-emergency-surface p-3">
              <View className="flex-row items-center justify-between gap-3"><Text className="flex-1 text-sm text-ink">Condividi coordinate precise</Text><Switch value={shareDangerCoordinates} onValueChange={setShareDangerCoordinates} trackColor={{ false: "#d9e2e3", true: "#b8d7f0" }} thumbColor={shareDangerCoordinates ? "#3b82c4" : "#7f8791"} /></View>
              <Button label={sosIsBlocked ? "SOS temporaneamente sospeso" : "Invia SOS vicino"} icon="warning-outline" variant="danger" disabled={sosIsBlocked} onPress={confirmDangerAlert} />
              {sosIsBlocked && sosBlockedUntil ? <Text className="text-xs font-medium text-danger">Disponibile il {sosBlockedUntil.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}.</Text> : null}
              {dangerStatus !== "Allarme non inviato" ? <Text className="text-xs text-muted">{dangerStatus}</Text> : null}
            </View>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Apri privacy e dati" onPress={() => router.push("/settings/privacy")} className="flex-row items-center gap-3 border-t border-border p-3">
            <Ionicons name="shield-checkmark-outline" size={20} color="#3b82c4" />
            <View className="flex-1"><Text className="font-medium text-ink">Privacy e dati</Text><Text className="mt-0.5 text-xs text-muted">Consensi, esportazione, account</Text></View>
            <Ionicons name="chevron-forward" size={18} color="#7f8791" />
          </Pressable>
        </View>

        <Button label="Esci" icon="log-out-outline" variant="secondary" onPress={() => {
          if (demoMode) {
            resetDemoScenario();
            return;
          }
          void supabase.auth.signOut().then(() => router.replace("/(auth)/login"));
        }} />
        </View>
      </View>
    </Screen>
  );
}
