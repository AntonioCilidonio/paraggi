import { type PropsWithChildren } from "react";
import { SafeAreaView, ScrollView, View } from "react-native";

type Props = PropsWithChildren<{
  scroll?: boolean;
}>;

export function Screen({ children, scroll = true }: Props) {
  if (!scroll) {
    return <SafeAreaView className="flex-1 bg-bg"><View className="flex-1 px-4">{children}</View></SafeAreaView>;
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

