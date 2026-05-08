import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { login, requestPasswordResetOtp, resetPasswordWithOtp, signup } from "../lib/api";
import { useLanguage } from "../lib/i18n";
import { colors, spacing } from "../lib/theme";

export default function AuthScreen() {
  const { isRtl, t } = useLanguage();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotPhone, setForgotPhone] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const introOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(1)).current;
  const copyOpacity = useRef(new Animated.Value(1)).current;

  const submitLabel = useMemo(() => (mode === "signup" ? t("signup") : t("login")), [mode, t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(logoScale, {
          toValue: 1.22,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(copyOpacity, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(introOpacity, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowIntro(false);
      });
    }, 1800);

    return () => clearTimeout(timer);
  }, [copyOpacity, introOpacity, logoScale]);

  async function submit() {
    setFormError("");

    if (mode === "signup") {
      if (!name.trim() || name.trim().length < 2) {
        setFormError(t("nameRequired"));
        return;
      }
      if (!phone.trim() || phone.trim().length < 8) {
        setFormError(t("phoneRequired"));
        return;
      }
      if (password.length < 6) {
        setFormError(t("passwordTooShort"));
        return;
      }
      if (!/[A-Z]/.test(password)) {
        setFormError(t("passwordNeedsUppercase"));
        return;
      }
      if (!/[0-9]/.test(password)) {
        setFormError(t("passwordNeedsNumber"));
        return;
      }
      if (password !== confirmPassword) {
        setFormError(t("passwordMismatch"));
        return;
      }
    }

    try {
      setLoading(true);
      if (mode === "signup") {
        await signup({ name: name.trim(), phone: phone.trim(), password });
      } else {
        await login({ phone: phone.trim(), password });
      }
      router.replace("/(tabs)/home");
    } catch (error) {
      const code = (error as Error & { code?: string })?.code;
      if (code === "phone_already_registered") {
        setFormError(t("phoneAlreadyRegistered"));
      } else if (code === "invalid_credentials") {
        setFormError(t("invalidCredentials"));
      } else {
        setFormError(t("authErrorMessage"));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPasswordRequest() {
    try {
      setForgotLoading(true);
      await requestPasswordResetOtp({ phone: forgotPhone });
      setOtpRequested(true);
      Alert.alert(t("otpSentTitle"), t("otpSentBody"));
    } catch {
      Alert.alert(t("appName"), t("authErrorMessage"));
    } finally {
      setForgotLoading(false);
    }
  }

  async function handlePasswordReset() {
    if (resetPassword !== resetConfirmPassword) {
      Alert.alert(t("appName"), t("authErrorMessage"));
      return;
    }

    try {
      setForgotLoading(true);
      await resetPasswordWithOtp({
        phone: forgotPhone,
        otp: resetOtp,
        password: resetPassword,
      });
      setForgotVisible(false);
      setOtpRequested(false);
      setResetOtp("");
      setResetPassword("");
      setResetConfirmPassword("");
      setPhone(forgotPhone);
      setMode("login");
      Alert.alert(t("passwordResetSuccessTitle"), t("passwordResetSuccessBody"));
    } catch (error) {
      const code = (error as Error & { code?: string })?.code;
      if (code === "password_reset_otp_invalid") {
        Alert.alert(t("appName"), t("invalidResetOtp"));
      } else if (code === "password_reset_otp_expired") {
        Alert.alert(t("appName"), t("expiredResetOtp"));
      } else {
        Alert.alert(t("appName"), t("authErrorMessage"));
      }
    } finally {
      setForgotLoading(false);
    }
  }

  function openForgotPassword() {
    setForgotPhone(phone);
    setResetOtp("");
    setResetPassword("");
    setResetConfirmPassword("");
    setOtpRequested(false);
    setForgotVisible(true);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.sand }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <View
          style={{
            flex: 1,
            paddingHorizontal: 22,
            paddingTop: 42,
            paddingBottom: 28,
            justifyContent: "center",
          }}
        >
          <View style={{ alignItems: "center", gap: spacing.md }}>
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
              <Ionicons name="navigate" size={36} color={colors.white} />
            </View>
            <Text style={{ color: colors.primary, fontSize: 42, fontWeight: "800", letterSpacing: 0 }}>Wasel</Text>
            <Text
              style={{
                color: "#586A61",
                fontSize: 15,
                lineHeight: 22,
                textAlign: "center",
                marginTop: -10,
              }}
            >
              {t("deliverAnywhere")}
            </Text>
          </View>

          <View style={{ marginTop: 28, gap: 14 }}>
            <View
              style={{
                backgroundColor: "#E8F0ED",
                borderRadius: 18,
                borderWidth: 1,
                borderColor: "#C2D5CE",
                padding: 5,
                flexDirection: isRtl ? "row-reverse" : "row",
              }}
            >
              <AuthTab active={mode === "login"} label="Sign In" onPress={() => { setMode("login"); setFormError(""); }} />
              <AuthTab active={mode === "signup"} label="Sign Up" onPress={() => { setMode("signup"); setFormError(""); }} />
            </View>

            {mode === "signup" ? (
              <AuthField value={name} onChangeText={setName} placeholder={t("name")} autoCapitalize="words" isRtl={isRtl} icon="person-outline" />
            ) : null}

            <AuthField value={phone} onChangeText={setPhone} placeholder="+966 5xx xxx xxxx" keyboardType="phone-pad" isRtl={isRtl} />
            <AuthField value={password} onChangeText={(v) => { setPassword(v); setFormError(""); }} placeholder={t("password")} secureTextEntry isRtl={isRtl} />

            {mode === "signup" ? (
              <Text style={{ color: "#7A8B82", fontSize: 13, lineHeight: 20, textAlign: isRtl ? "right" : "left", marginTop: -6 }}>
                {t("passwordRules")}
              </Text>
            ) : null}

            {mode === "signup" ? (
              <AuthField
                value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); setFormError(""); }}
                placeholder={t("confirmPassword")}
                secureTextEntry
                isRtl={isRtl}
              />
            ) : null}

            {formError ? (
              <View style={{ backgroundColor: "#FDE8E8", borderRadius: 12, borderWidth: 1, borderColor: "#F5C2C2", paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={{ color: "#B91C1C", fontSize: 14, fontWeight: "600", textAlign: isRtl ? "right" : "left" }}>
                  {formError}
                </Text>
              </View>
            ) : null}

            {mode === "login" ? (
              <Pressable onPress={openForgotPassword}>
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600", textAlign: isRtl ? "left" : "right" }}>
                  {t("forgotPassword")}
                </Text>
              </Pressable>
            ) : null}

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
                  shadowColor: colors.primary,
                  shadowOpacity: 0.14,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                },
                pressed && { opacity: 0.88 },
              ]}
            >
              <Text style={{ color: colors.white, fontSize: 16, fontWeight: "800" }}>{loading ? "..." : submitLabel}</Text>
            </Pressable>

            <Text style={{ color: "#96A096", fontSize: 14, lineHeight: 22, textAlign: "center" }}>{t("termsAgreement")}</Text>

            <Pressable onPress={() => router.push("/rider-signup")} style={({ pressed }) => [pressed && { opacity: 0.72 }]}>
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "700", textAlign: "center" }}>
                {t("registerAsRider")}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      {showIntro ? (
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            opacity: introOpacity,
          }}
        >
          <Animated.View style={{ alignItems: "center", gap: 18, transform: [{ scale: logoScale }] }}>
            <View
              style={{
                width: 106,
                height: 106,
                borderRadius: 30,
                backgroundColor: "rgba(255,255,255,0.1)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="navigate" size={48} color={colors.white} />
            </View>
            <Animated.View style={{ alignItems: "center", gap: 10, opacity: copyOpacity }}>
              <Text style={{ color: colors.white, fontSize: 44, fontWeight: "800", letterSpacing: 0 }}>Wasel</Text>
              <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 17, fontWeight: "600" }}>{t("deliverAnywhere")}</Text>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      ) : null}
      <Modal visible={forgotVisible} transparent animationType="fade" onRequestClose={() => setForgotVisible(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(15, 23, 18, 0.24)",
            padding: 24,
            justifyContent: "center",
          }}
        >
          <View
            style={{
              borderRadius: 24,
              backgroundColor: colors.sand,
              padding: 22,
              gap: 14,
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 24, fontWeight: "800", textAlign: isRtl ? "right" : "left" }}>
              {t("forgotPasswordTitle")}
            </Text>
            <Text style={{ color: "#586A61", fontSize: 15, lineHeight: 22, textAlign: isRtl ? "right" : "left" }}>
              {otpRequested ? t("resetPasswordPrompt") : t("forgotPasswordBody")}
            </Text>

            <AuthField value={forgotPhone} onChangeText={setForgotPhone} placeholder="+966 5xx xxx xxxx" keyboardType="phone-pad" isRtl={isRtl} />

            {otpRequested ? (
              <>
                <AuthField value={resetOtp} onChangeText={setResetOtp} placeholder={t("otpCode")} keyboardType="phone-pad" isRtl={isRtl} />
                <AuthField value={resetPassword} onChangeText={setResetPassword} placeholder={t("newPassword")} secureTextEntry isRtl={isRtl} />
                <AuthField
                  value={resetConfirmPassword}
                  onChangeText={setResetConfirmPassword}
                  placeholder={t("confirmPassword")}
                  secureTextEntry
                  isRtl={isRtl}
                />
              </>
            ) : null}

            <Pressable
              disabled={forgotLoading}
              onPress={otpRequested ? handlePasswordReset : handleForgotPasswordRequest}
              style={({ pressed }) => [
                {
                  minHeight: 52,
                  borderRadius: 18,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                },
                pressed && { opacity: 0.88 },
              ]}
            >
              <Text style={{ color: colors.white, fontSize: 16, fontWeight: "800" }}>
                {forgotLoading ? "..." : otpRequested ? t("updatePassword") : t("sendOtp")}
              </Text>
            </Pressable>

            <Pressable onPress={() => setForgotVisible(false)} style={{ paddingVertical: 8 }}>
              <Text style={{ color: "#586A61", fontSize: 15, fontWeight: "700", textAlign: "center" }}>{t("cancel")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function AuthTab({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          minHeight: 50,
          borderRadius: 15,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: active ? colors.primary : "transparent",
        },
        pressed && { opacity: 0.88 },
      ]}
    >
      <Text style={{ color: active ? colors.white : "#5E6F68", fontSize: 15, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

function AuthField({
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
  icon?: string;
}) {
  return (
    <View
      style={{
        minHeight: 68,
        borderRadius: 18,
        backgroundColor: "#FFFFFF",
        borderWidth: 1.5,
        borderColor: "#C2D5CE",
        justifyContent: "center",
        paddingHorizontal: 18,
        flexDirection: isRtl ? "row-reverse" : "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Ionicons name={(secureTextEntry ? "lock-closed-outline" : (icon || "call-outline")) as any} size={18} color="#7A8275" />
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
