import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { I18nManager } from "react-native";
import { LanguageProvider } from "../lib/i18n";

I18nManager.allowRTL(true);
I18nManager.forceRTL(false);

export default function RootLayout() {
  return (
    <LanguageProvider>
      <StatusBar style="dark" />
      <Slot />
    </LanguageProvider>
  );
}
