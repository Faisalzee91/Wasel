import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { apiRequest, setToken } from "../lib/api";
import { useLanguage } from "../lib/i18n";
import { colors, spacing } from "../lib/theme";
import type { User } from "../lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_KEY = "wasel-user-v2";

export default function RiderSignupScreen() {
  const { isRtl, t } = useLanguage();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    if (name.trim().length < 2) return t("name") + ": min 2 chars";
    if (phone.trim().length < 8) return t("phone") + ": min 8 digits";
    if (password.length < 6) return t("password") + ": min 6 chars";
    return null;
  }

  async function submit() {
    const error = validate();
    if (error) {
      Alert.alert(t("appName"), error);
      return;
    }

    try {
      setLoading(true);
      const payload = await apiRequest<{ token: string; user: User }>("/auth/rider-signup", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          password,
        }),
      });
      await setToken(payload.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(payload.user));
      Alert.alert(t("appName"), t("riderSignupSuccess"));
      router.replace("/(tabs)/home");
    } catch {
      Alert.alert(t("authErrorTitle"), t("authErrorMessage"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.sand }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <View
          style={{
            flex: 1,
            paddingHorizontal: 22,
            paddingTop: 56,
            paddingBottom: 32,
            justifyContent: "center",
          }}
        >
          <View style={{ alignItems: "center", gap: spacing.md, marginBottom: 32 }}>
            <View
              style={{
                width: 86,
                height: 86,
                borderRadius: 24,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: colors.primary,
                shadowOpacity: 0.18,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 8 },
              }}
            >
              <Ionicons name="bicycle" size={38} color={colors.white} />
            </View>
            <Text style={{ color: "#D5DAC7", fontSize: 42, fontWeight: "800" }}>Wasel</Text>
            <View style={{ alignItems: "center", gap: 4 }}>
              <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "800", textAlign: "center" }}>
                {t("riderSignupTitle")}
              </Text>
              <Text style={{ color: "#586A61", fontSize: 15, lineHeight: 22, textAlign: "center" }}>
                {t("riderSignupSubtitle")}
              </Text>
            </View>
          </View>

          <View style={{ gap: 14 }}>
            <RiderField
              value={name}
              onChangeText={setName}
              placeholder={t("name")}
              autoCapitalize="words"
              isRtl={isRtl}
              icon="person-outline"
            />
            <RiderField
              value={phone}
              onChangeText={setPhone}
              placeholder="+966 5xx xxx xxxx"
              keyboardType="phone-pad"
              isRtl={isRtl}
              icon="call-outline"
            />
            <RiderField
              value={password}
              onChangeText={setPassword}
              placeholder={t("password")}
              secureTextEntry
              isRtl={isRtl}
              icon="lock-closed-outline"
            />

            <Pressable
              disabled={loading}
              onPress={submit}
              style={({ pressed }) => [
                {
                  minHeight: 52,
                  borderRadius: 18,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 4,
                  shadowColor: colors.primary,
                  shadowOpacity: 0.14,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                },
                pressed && { opacity: 0.88 },
              ]}
            >
              <Text style={{ color: colors.white, fontSize: 16, fontWeight: "800" }}>
                {loading ? "..." : t("signup")}
              </Text>
            </Pressable>

            <Pressable onPress={() => router.replace("/")} style={{ paddingVertical: 8 }}>
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "700", textAlign: "center" }}>
                {t("backToLogin")}
              </Text>
            </Pressable>

            <Text style={{ color: "#96A096", fontSize: 14, lineHeight: 22, textAlign: "center" }}>
              {t("termsAgreement")}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RiderField({
  isRtl,
  secureTextEntry,
  icon,
  ...props
}: {
  isRtl: boolean;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "phone-pad";
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  icon: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <View
      style={{
        minHeight: 68,
        borderRadius: 18,
        backgroundColor: "#F3E7CB",
        borderWidth: 1,
        borderColor: "#D8CCAE",
        justifyContent: "center",
        paddingHorizontal: 18,
        flexDirection: isRtl ? "row-reverse" : "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Ionicons name={icon} size={18} color="#7A8275" />
      <TextInput
        {...props}
        secureTextEntry={secureTextEntry}
        placeholderTextColor="#7A8275"
        autoCorrect={false}
        style={{
          flex: 1,
          height: 44,
          color: colors.charcoal,
          fontSize: 16,
          textAlign: isRtl ? "right" : "left",
        }}
      />
    </View>
  );
}
