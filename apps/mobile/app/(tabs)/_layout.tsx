import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

const icons = {
  feed: ["radio-outline", "radio"] as const,
  heatmap: ["map-outline", "map"] as const,
  chats: ["chatbubbles-outline", "chatbubbles"] as const,
  history: ["trail-sign-outline", "trail-sign"] as const,
  profile: ["person-circle-outline", "person-circle"] as const
};

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: "#16808a",
      tabBarInactiveTintColor: "#62717a",
      tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
      tabBarItemStyle: { justifyContent: "center" },
      tabBarStyle: { height: 70, paddingTop: 8, paddingBottom: 10 }
    }}>
      <Tabs.Screen name="feed" options={{ title: "Vicino", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? icons.feed[1] : icons.feed[0]} size={22} color={color} /> }} />
      <Tabs.Screen name="heatmap" options={{ title: "Mappa", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? icons.heatmap[1] : icons.heatmap[0]} size={22} color={color} /> }} />
      <Tabs.Screen name="chats" options={{ title: "Chat", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? icons.chats[1] : icons.chats[0]} size={22} color={color} /> }} />
      <Tabs.Screen name="history" options={{ title: "Aree", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? icons.history[1] : icons.history[0]} size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profilo", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? icons.profile[1] : icons.profile[0]} size={22} color={color} /> }} />
    </Tabs>
  );
}
