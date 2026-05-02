import { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing } from "../lib/theme";
import { useLanguage } from "../lib/i18n";

export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      {children}
    </SafeAreaView>
  );
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function Title({ children }: PropsWithChildren) {
  const { isRtl } = useLanguage();
  return <Text style={[styles.title, { textAlign: isRtl ? "right" : "left" }]}>{children}</Text>;
}

export function Label({ children }: PropsWithChildren) {
  const { isRtl } = useLanguage();
  return <Text style={[styles.label, { textAlign: isRtl ? "right" : "left" }]}>{children}</Text>;
}

export function Field(props: TextInputProps) {
  const { isRtl } = useLanguage();
  return (
    <TextInput
      placeholderTextColor={colors.gray}
      {...props}
      style={[styles.field, { textAlign: isRtl ? "right" : "left" }, props.style]}
    />
  );
}

export function PrimaryButton({
  children,
  loading,
  onPress,
}: PropsWithChildren<{ loading?: boolean; onPress: () => void }>) {
  return (
    <Pressable
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
    >
      {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{children}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ children, onPress }: PropsWithChildren<{ onPress: () => void }>) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
      <Text style={styles.secondaryText}>{children}</Text>
    </Pressable>
  );
}

export function Pill({ children }: PropsWithChildren) {
  const { isRtl } = useLanguage();
  return (
    <View style={[styles.pill, { alignSelf: isRtl ? "flex-end" : "flex-start" }]}>
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.sand,
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: "700",
    textAlign: "right",
  },
  label: {
    color: colors.charcoal,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
  },
  field: {
    minHeight: 48,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    color: colors.charcoal,
    fontSize: 16,
    paddingHorizontal: spacing.md,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  primaryText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: radius.sm,
    borderColor: colors.primary,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  secondaryText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.82,
  },
  pill: {
    alignSelf: "flex-end",
    borderRadius: radius.sm,
    backgroundColor: "#E7F2EF",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pillText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 13,
  },
});
