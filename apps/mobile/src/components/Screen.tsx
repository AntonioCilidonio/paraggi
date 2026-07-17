import { type PropsWithChildren } from "react";
import { Platform, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CivicBottomBar } from "@/components/CivicBottomBar";

type Props = PropsWithChildren<{
  scroll?: boolean;
  showBottomBar?: boolean;
  keyboardAware?: boolean;
}>;

export function Screen({ children, scroll = true, showBottomBar = false, keyboardAware = false }: Props) {
  const insets = useSafeAreaInsets();
  const isAndroid = Platform.OS === "android";
  const contentTop = insets.top + 12;
  const statusBarOverlap = Math.max(insets.top + (isAndroid ? 3 : 1), 1);

  if (!scroll) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["left", "right", "bottom"]}>
        <View pointerEvents="none" className="absolute left-0 right-0 top-0 bg-primary" style={{ height: statusBarOverlap }} />
        <View className="flex-1 px-4" style={{ paddingTop: contentTop }}>{children}</View>
        {showBottomBar ? <CivicBottomBar /> : null}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["left", "right", "bottom"]}>
      <View pointerEvents="none" className="absolute left-0 right-0 top-0 bg-primary" style={{ height: statusBarOverlap }} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4"
        contentContainerStyle={{ paddingTop: contentTop, paddingBottom: keyboardAware ? 160 : 32 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets={keyboardAware && Platform.OS === "ios"}
      >
        {children}
      </ScrollView>
      {showBottomBar ? <CivicBottomBar /> : null}
    </SafeAreaView>
  );
}
