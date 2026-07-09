import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "oklch(0.58 0.118 188)" }}>
      <Tabs.Screen name="feed" options={{ title: "Vicino" }} />
      <Tabs.Screen name="heatmap" options={{ title: "Mappa" }} />
      <Tabs.Screen name="chats" options={{ title: "Chat" }} />
      <Tabs.Screen name="history" options={{ title: "Aree" }} />
      <Tabs.Screen name="profile" options={{ title: "Profilo" }} />
    </Tabs>
  );
}

