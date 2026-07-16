import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { Keyboard, Pressable, Text, View } from "react-native";
import { openPostComposer } from "@/services/postComposerNavigation";

export type TabKey = "feed" | "heatmap" | "chats" | "history";

const items: Array<{
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  href: "/(tabs)/feed" | "/(tabs)/heatmap" | "/(tabs)/chats" | "/(tabs)/history";
}> = [
  { key: "feed", label: "Vicino", icon: "radio-outline", activeIcon: "radio", href: "/(tabs)/feed" },
  { key: "heatmap", label: "Mappa", icon: "map-outline", activeIcon: "map", href: "/(tabs)/heatmap" },
  { key: "chats", label: "Chat", icon: "chatbubbles-outline", activeIcon: "chatbubbles", href: "/(tabs)/chats" },
  { key: "history", label: "Aree", icon: "trail-sign-outline", activeIcon: "trail-sign", href: "/(tabs)/history" },
];

function resolveActiveTab(pathname: string): TabKey | "create" {
  if (pathname.includes("compose")) return "create";
  if (pathname.includes("heatmap") || pathname.includes("danger")) return "heatmap";
  if (pathname.includes("chat")) return "chats";
  if (pathname.includes("history") || pathname.includes("area")) return "history";
  return "feed";
}

function NavItem({ item, active, onPress, unreadCount = 0 }: { item: (typeof items)[number]; active: boolean; onPress: () => void; unreadCount?: number }) {
  const color = active ? "#ffffff" : "#c7dcf0";
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className="relative flex-1 items-center justify-center gap-0.5"
    >
      <Ionicons name={active ? item.activeIcon : item.icon} size={19} color={color} />
      <Text className={`text-[10px] font-medium ${active ? "text-white" : "text-[#c7dcf0]"}`}>{item.label}</Text>
      {item.key === "chats" && unreadCount > 0 ? (
        <View className="absolute right-4 top-0 min-h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1">
          <Text className="text-[9px] font-bold text-white">{unreadCount > 99 ? "99+" : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function CivicBottomBar({ unreadCount = 0, activeTab, onNavigate }: { unreadCount?: number; activeTab?: TabKey; onNavigate?: (tab: TabKey) => void }) {
  const pathname = usePathname();
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());
  const active = activeTab ?? resolveActiveTab(pathname);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  if (keyboardVisible) return null;

  const navigate = (item: (typeof items)[number]) => {
    if (active === item.key) return;
    if (onNavigate) onNavigate(item.key);
    else router.replace(item.href);
  };

  return (
    <View className="h-[67px] flex-row items-end bg-primary px-1 pb-2 pt-1">
      <NavItem item={items[0]} active={active === "feed"} onPress={() => navigate(items[0])} />
      <NavItem item={items[1]} active={active === "heatmap"} onPress={() => navigate(items[1])} />
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel="Pubblica"
        accessibilityState={{ selected: active === "create" }}
        onPress={openPostComposer}
        className="flex-1 items-center justify-end gap-0.5"
      >
        <View className="-mt-5 h-12 w-12 items-center justify-center rounded-full bg-accent">
          <Ionicons name="add" size={25} color="#ffffff" />
        </View>
        <Text className="text-[10px] font-medium text-white">Pubblica</Text>
      </Pressable>
      <NavItem item={items[2]} active={active === "chats"} onPress={() => navigate(items[2])} unreadCount={unreadCount} />
      <NavItem item={items[3]} active={active === "history"} onPress={() => navigate(items[3])} />
    </View>
  );
}
