import { type PropsWithChildren } from "react";
import { Platform, ScrollView, StatusBar, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = PropsWithChildren<{
  scroll?: boolean;
}>;

export function Screen({ children, scroll = true }: Props) {
  const androidTop = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;

  if (!scroll) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["left", "right", "bottom"]}>
        <View className="flex-1 px-4" style={{ paddingTop: androidTop + 12 }}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["left", "right", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8" contentContainerStyle={{ paddingTop: androidTop + 12 }}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
