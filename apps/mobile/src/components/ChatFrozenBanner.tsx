import type { ChatStatus } from "@paraggi/domain";
import { Text, View } from "react-native";

const copy: Record<ChatStatus, string> = {
  active: "Chat attiva: siete abbastanza vicini.",
  frozen_distance: "Chat sospesa: siete fuori dal raggio condiviso. Lo storico resta visibile.",
  frozen_permission: "Chat sospesa: serve una posizione valida da entrambi.",
  frozen_moderation: "Chat sospesa per verifica di sicurezza.",
  closed: "Chat chiusa."
};

export function ChatFrozenBanner({ status }: { status: ChatStatus }) {
  const active = status === "active";

  return (
    <View className={`rounded-card p-3 ${active ? "bg-primary" : "bg-surface border border-border"}`}>
      <Text className={active ? "font-semibold text-white" : "font-semibold text-ink"}>{copy[status]}</Text>
    </View>
  );
}

