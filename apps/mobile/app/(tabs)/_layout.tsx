import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarIcon: () => null,
      tabBarActiveTintColor: "#16808a",
      tabBarInactiveTintColor: "#62717a",
      tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
      tabBarItemStyle: { justifyContent: "center" },
      tabBarStyle: { height: 62, paddingTop: 8, paddingBottom: 10 }
    }}>
      <Tabs.Screen name="feed" options={{ title: "Vicino" }} />
      <Tabs.Screen name="heatmap" options={{ title: "Mappa" }} />
      <Tabs.Screen name="chats" options={{ title: "Chat" }} />
      <Tabs.Screen name="history" options={{ title: "Aree" }} />
      <Tabs.Screen name="profile" options={{ title: "Profilo" }} />
    </Tabs>
  );
}
