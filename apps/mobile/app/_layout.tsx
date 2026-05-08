import * as Notifications from "expo-notifications";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { I18nManager, Platform } from "react-native";
import { apiRequest } from "../lib/api";
import { LanguageProvider } from "../lib/i18n";

I18nManager.allowRTL(true);
I18nManager.forceRTL(false);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function registerPushToken() {
  if (Platform.OS === "web") return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return;

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    await apiRequest("/users/push-token", {
      method: "POST",
      body: JSON.stringify({ pushToken: token.data }),
    });
  } catch {
    // Not logged in yet or no network — silently skip
  }
}

export default function RootLayout() {
  useEffect(() => {
    registerPushToken();
  }, []);

  return (
    <LanguageProvider>
      <StatusBar style="dark" />
      <Slot />
    </LanguageProvider>
  );
}
