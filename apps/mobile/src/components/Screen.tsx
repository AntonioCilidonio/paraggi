import { type PropsWithChildren, useEffect, useState } from "react";
import { Keyboard, Platform, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CivicBottomBar } from "@/components/CivicBottomBar";

type Props = PropsWithChildren<{
  scroll?: boolean;
  showBottomBar?: boolean;
  keyboardAware?: boolean;
}>;

export function Screen({ children, scroll = true, showBottomBar = false, keyboardAware = false }: Props) {
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const contentTop = insets.top + 12;
  const statusBarOverlap = Math.max(insets.top + 4, 4);

  useEffect(() => {
    if (!showBottomBar) return;
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [showBottomBar]);

  if (!scroll) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={showBottomBar ? ["left", "right"] : ["left", "right", "bottom"]}>
        <View pointerEvents="none" className="absolute left-0 right-0 top-0 z-10 bg-primary" style={{ height: statusBarOverlap }} />
        <View className="flex-1 px-4" style={{ paddingTop: contentTop }}>{children}</View>
        {showBottomBar && !keyboardVisible ? <CivicBottomBar /> : null}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={showBottomBar ? ["left", "right"] : ["left", "right", "bottom"]}>
      <View pointerEvents="none" className="absolute left-0 right-0 top-0 z-10 bg-primary" style={{ height: statusBarOverlap }} />
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
      {showBottomBar && !keyboardVisible ? <CivicBottomBar /> : null}
    </SafeAreaView>
  );
}
