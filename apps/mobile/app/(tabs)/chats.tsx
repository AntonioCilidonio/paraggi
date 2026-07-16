import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { AppHeader } from "@/components/AppHeader";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { demoMode } from "@/config/env";
import { demoChats } from "@/demo/data";
import { callFunction } from "@/services/api";
import { getFriendlyError } from "@/services/errors";
import { sendLocalNotification } from "@/services/notifications";
import { useAppStore } from "@/stores/appStore";

type ChatRow = {
  id: string;
  other_user_id?: string;
  status: string;
  is_connected?: boolean;
  reconnect_request_status?: "incoming" | "outgoing" | null;
  last_distance_meters: number | null;
  last_message_at: string | null;
  updated_at: string;
  unread_count?: number;
  other_profile?: { display_name: string; reputation_score: number } | null;
};

type RequestRow = {
  id: string;
  requester_id?: string;
  status: string;
  message?: string | null;
  created_at: string;
  profiles?: { display_name: string; reputation_score: number } | null;
  from?: string;
  reason?: string;
};

type ChatInbox = {
  requests: RequestRow[];
  chats: ChatRow[];
  totalUnread: number;
};

function requestName(request: RequestRow): string {
  return request.profiles?.display_name ?? request.from ?? "Persona vicina";
}

function requestReason(request: RequestRow): string {
  return (
    request.reason ??
    request.message ??
    "Vuole aprire una chat privata contestuale."
  );
}

export default function ChatsScreen() {
  const demoStatusById = useAppStore((state) => state.demoChatStatusById);
  const requests = useAppStore((state) => state.demoRequests);
  const acceptDemoRequest = useAppStore((state) => state.acceptDemoRequest);
  const declineDemoRequest = useAppStore((state) => state.declineDemoRequest);
  const [actionError, setActionError] = useState<string | null>(null);
  const [respondingAction, setRespondingAction] = useState<string | null>(null);
  const requestActionRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const chatQueryKey = ["chats", demoStatusById] as const;
  const chats = useQuery<ChatInbox>({
    queryKey: chatQueryKey,
    queryFn: async () => {
      if (demoMode) {
        return {
          requests,
          totalUnread: 0,
          chats: demoChats.map((chat) => ({
            ...chat,
            status: demoStatusById[chat.id] ?? chat.status,
            is_connected: true,
            reconnect_request_status: null,
            other_user_id:
              chat.id === "demo-active-chat" ? "demo-marta" : "demo-luca",
            other_profile: {
              display_name: chat.id === "demo-active-chat" ? "Marta" : "Luca",
              reputation_score: 24,
            },
          })),
        };
      }
      return callFunction<{ requests: RequestRow[]; chats: ChatRow[]; totalUnread: number }>(
        "get-chat-inbox",
        { method: "GET" },
      );
    },
  });

  useFocusEffect(useCallback(() => {
    void chats.refetch();
  }, [chats.refetch]));

  async function accept(requestId: string) {
    if (requestActionRef.current) return;
    requestActionRef.current = requestId;
    setRespondingAction(`${requestId}:accept`);
    setActionError(null);
    try {
      let status = "accepted";
      let alreadyResponded = false;
      if (demoMode) {
        acceptDemoRequest(requestId);
      } else {
        const result = await callFunction<{
          status: "accepted" | "rejected";
          alreadyResponded?: boolean;
        }>("respond-connection", {
          body: { requestId, accept: true },
        });
        status = result.status;
        alreadyResponded = Boolean(result.alreadyResponded);
      }
      queryClient.setQueryData<ChatInbox>(chatQueryKey, (current) => current
        ? { ...current, requests: current.requests.filter((request) => request.id !== requestId) }
        : current);
      await sendLocalNotification(
        status === "accepted" ? "Richiesta accettata" : "Richiesta gia gestita",
        status === "accepted"
          ? alreadyResponded ? "La chat privata era gia disponibile." : "La chat privata e ora disponibile."
          : "La richiesta era gia stata rifiutata.",
      );
      await chats.refetch();
    } catch (error) {
      setActionError(
        getFriendlyError(
          error,
          "Richiesta non accettata. Controlla login e rete.",
        ),
      );
    } finally {
      requestActionRef.current = null;
      setRespondingAction(null);
    }
  }

  async function decline(requestId: string) {
    if (requestActionRef.current) return;
    requestActionRef.current = requestId;
    setRespondingAction(`${requestId}:decline`);
    setActionError(null);
    try {
      let status = "rejected";
      let alreadyResponded = false;
      if (demoMode) {
        declineDemoRequest(requestId);
      } else {
        const result = await callFunction<{
          status: "accepted" | "rejected";
          alreadyResponded?: boolean;
        }>("respond-connection", {
          body: { requestId, accept: false },
        });
        status = result.status;
        alreadyResponded = Boolean(result.alreadyResponded);
      }
      queryClient.setQueryData<ChatInbox>(chatQueryKey, (current) => current
        ? { ...current, requests: current.requests.filter((request) => request.id !== requestId) }
        : current);
      await sendLocalNotification(
        status === "rejected" ? "Richiesta rifiutata" : "Richiesta gia gestita",
        status === "rejected"
          ? alreadyResponded ? "La richiesta era gia stata rifiutata." : "La connessione privata non e stata aperta."
          : "La chat privata era gia disponibile.",
      );
      await chats.refetch();
    } catch (error) {
      setActionError(
        getFriendlyError(
          error,
          "Richiesta non rifiutata. Controlla login e rete.",
        ),
      );
    } finally {
      requestActionRef.current = null;
      setRespondingAction(null);
    }
  }

  async function reconnect(chat: ChatRow) {
    if (!chat.other_user_id) {
      setActionError("Non riesco a identificare la persona da riconnettere.");
      return;
    }
    setActionError(null);
    try {
      const result = await callFunction<{ alreadyPending?: boolean }>(
        "request-connection",
        {
          body: {
            chatId: chat.id,
            recipientId: chat.other_user_id,
            message: "Vorrei ripristinare la nostra chat privata.",
          },
        },
      );
      await sendLocalNotification(
        result.alreadyPending
          ? "Richiesta gia inviata"
          : "Richiesta di riconnessione inviata",
        result.alreadyPending
          ? "La persona deve ancora rispondere."
          : "La chat tornera attiva dopo l'accettazione.",
      );
      await chats.refetch();
    } catch (error) {
      setActionError(
        getFriendlyError(
          error,
          "Riconnessione non richiesta. Controlla login e rete.",
        ),
      );
    }
  }

  return (
    <Screen>
      <View className="gap-5">
        <AppHeader />
        <PageHeader
          title="Le tue chat"
          subtitle="Una conversazione privata per ogni persona connessa."
        />
        {chats.isError ? (
          <View className="rounded-card border border-danger bg-surface p-4">
            <Text className="font-semibold text-danger">Chat non caricate</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">
              {getFriendlyError(
                chats.error,
                "Controlla login e rete, poi riprova.",
              )}
            </Text>
            <View className="mt-3">
              <Button
                label="Riprova"
                variant="secondary"
                onPress={() => void chats.refetch()}
              />
            </View>
          </View>
        ) : null}
        {actionError ? (
          <Text className="rounded-card bg-danger/10 p-3 text-sm font-semibold text-danger">
            {actionError}
          </Text>
        ) : null}
        {(chats.data?.requests ?? []).length > 0 ? <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <Ionicons name="person-add-outline" size={19} color="#3b82c4" />
            <Text className="font-semibold text-ink">Richieste private</Text>
          </View>
          {(chats.data?.requests ?? []).map((request) => (
            <View
              key={request.id}
              className="gap-3 rounded-card bg-category-question p-4"
            >
              <View className="flex-row items-start gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
                  <Text className="font-bold text-primary">
                    {requestName(request).slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-ink">
                    {requestName(request)}
                  </Text>
                  <Text className="mt-1 text-sm leading-5 text-muted">
                    {requestReason(request)}
                  </Text>
                </View>
              </View>
              {request.status === "pending" ? (
                <View className="flex-row gap-2">
                  <Button
                    label="Accetta"
                    className="flex-1"
                    loading={respondingAction === `${request.id}:accept`}
                    disabled={Boolean(respondingAction)}
                    onPress={() => void accept(request.id)}
                  />
                  <Button
                    label="Rifiuta"
                    variant="secondary"
                    className="flex-1"
                    loading={respondingAction === `${request.id}:decline`}
                    disabled={Boolean(respondingAction)}
                    onPress={() => void decline(request.id)}
                  />
                </View>
              ) : null}
            </View>
          ))}
        </View> : null}
        {chats.isLoading ? (
          <View className="h-32 rounded-card bg-surface" />
        ) : null}
        {chats.data?.chats.length === 0 ? (
          <View className="rounded-card border border-border bg-surface p-4">
            <Text className="font-semibold text-ink">Nessuna chat ancora</Text>
            <Text className="mt-1 text-sm text-muted">
              Commenta un post vicino e richiedi una connessione privata.
            </Text>
          </View>
        ) : null}
        <View className="overflow-hidden rounded-card bg-white px-4">
          {chats.data?.chats
            .filter((chat, index, allChats) => {
              const identity =
                chat.other_user_id ??
                chat.other_profile?.display_name ??
                chat.id;
              return (
                allChats.findIndex(
                  (candidate) =>
                    (candidate.other_user_id ??
                      candidate.other_profile?.display_name ??
                      candidate.id) === identity,
                ) === index
              );
            })
            .map((chat) => (
              <View
                key={chat.id}
                className="gap-3 border-b border-border py-4 last:border-b-0"
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={chat.unread_count
                    ? `Apri chat, ${chat.unread_count} messaggi non letti`
                    : chat.is_connected === false ? "Apri storico della chat rimossa" : "Apri chat"}
                  onPress={() => router.push(`/chat/${chat.id}`)}
                >
                  <View className="flex-row items-center gap-3">
                    <View className="h-11 w-11 items-center justify-center rounded-full bg-surface">
                      <Text className="font-bold text-primary">
                        {(chat.other_profile?.display_name ?? "C")
                          .slice(0, 1)
                          .toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-ink">
                        {chat.other_profile?.display_name ?? "Chat privata"}
                      </Text>
                      <Text className="mt-1 text-sm text-muted">
                        {chat.is_connected === false
                          ? "Lo storico resta disponibile"
                          : chat.last_message_at
                            ? `Ultimo messaggio ${new Date(chat.last_message_at).toLocaleDateString([], { day: "2-digit", month: "2-digit" })} alle ${new Date(chat.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                            : "Inizia la conversazione"}
                      </Text>
                    </View>
                    {chat.unread_count ? (
                      <View className="min-h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5">
                        <Text className="text-xs font-bold text-white">{chat.unread_count > 99 ? "99+" : chat.unread_count}</Text>
                      </View>
                    ) : null}
                    <Ionicons name="chevron-forward" size={20} color="#62717a" />
                  </View>
                </Pressable>
                {chat.is_connected === false ? (
                  <Button
                    label={
                      chat.reconnect_request_status === "outgoing"
                        ? "Richiesta inviata"
                        : chat.reconnect_request_status === "incoming"
                          ? "Richiesta da accettare"
                          : "Riconnetti"
                    }
                    icon={
                      chat.reconnect_request_status
                        ? "time-outline"
                        : "person-add-outline"
                    }
                    variant="secondary"
                    disabled={Boolean(chat.reconnect_request_status)}
                    onPress={() => void reconnect(chat)}
                  />
                ) : null}
              </View>
            ))}
        </View>
      </View>
    </Screen>
  );
}
