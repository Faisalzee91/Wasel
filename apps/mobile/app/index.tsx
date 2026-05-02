import { router } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Field, PrimaryButton, Screen, SecondaryButton, Title } from "../components/ui";
import { login, signup } from "../lib/api";
import { useLanguage } from "../lib/i18n";
import { colors, spacing } from "../lib/theme";

export default function AuthScreen() {
  const { isRtl, t } = useLanguage();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    try {
      setLoading(true);
      if (mode === "signup") {
        await signup({ name, phone, password });
      } else {
        await login({ phone, password });
      }
      router.replace("/(tabs)/home");
    } catch (error) {
      Alert.alert(t("authErrorTitle"), t("authErrorMessage"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <View style={{ flex: 1, justifyContent: "center", gap: spacing.lg }}>
          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: colors.primary, fontSize: 44, fontWeight: "800", textAlign: isRtl ? "right" : "left" }}>
              {t("appName")}
            </Text>
            <Title>{t("tagline")}</Title>
            <Text style={{ color: colors.gray, fontSize: 16, lineHeight: 24, textAlign: isRtl ? "right" : "left" }}>
              {t("serviceLine")}
            </Text>
          </View>

          <View style={{ gap: spacing.md }}>
            {mode === "signup" && (
              <Field value={name} onChangeText={setName} placeholder={t("name")} autoCapitalize="words" />
            )}
            <Field value={phone} onChangeText={setPhone} placeholder={t("phone")} keyboardType="phone-pad" />
            <Field value={password} onChangeText={setPassword} placeholder={t("password")} secureTextEntry />
            <PrimaryButton loading={loading} onPress={submit}>
              {mode === "signup" ? t("signup") : t("login")}
            </PrimaryButton>
            <SecondaryButton onPress={() => setMode(mode === "signup" ? "login" : "signup")}>
              {mode === "signup" ? t("hasAccount") : t("newAccount")}
            </SecondaryButton>
          </View>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
