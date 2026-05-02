import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Card, PrimaryButton, Screen, SecondaryButton, Title } from "../../components/ui";
import { apiRequest, clearToken, fetchCurrentUser, User } from "../../lib/api";
import { useLanguage } from "../../lib/i18n";
import { getDistrictByCoordinates, getRiyadhLocation, riyadhDistricts } from "../../lib/riyadhLocations";
import { colors, radius, spacing } from "../../lib/theme";

export default function ProfileScreen() {
  const { isRtl, language, setLanguage, t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [district, setDistrict] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;

      fetchCurrentUser()
        .then((account) => {
          if (!active) return;
          setUser(account);
          if (account.role === "rider") {
            setIsAvailable(Boolean(account.isAvailable));
            setDistrict(getDistrictByCoordinates(account.currentLat, account.currentLng));
          }
        })
        .catch(() => {
          if (active) setUser(null);
        });

      return () => {
        active = false;
      };
    }, []),
  );

  async function logout() {
    await clearToken();
    router.replace("/");
  }

  async function saveRiderSettings() {
    const location = getRiyadhLocation(district);

    try {
      const payload = await apiRequest<{ rider: User }>("/rider/availability", {
        method: "PATCH",
        body: JSON.stringify({
          isAvailable,
          currentLat: location?.lat,
          currentLng: location?.lng,
        }),
      });
      setUser(payload.rider);
      Alert.alert(t("riderSettingsSavedTitle"), t("riderSettingsSavedBody"));
    } catch (error) {
      Alert.alert(t("appName"), error instanceof Error ? error.message : "Could not update rider status.");
    }
  }

  if (user?.role === "rider") {
    return (
      <Screen>
        <Title>{t("profileTitle")}</Title>
        <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}>
          <Card>
            <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{t("name")}</Text>
            <Text style={{ color: colors.charcoal, fontSize: 18, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
              {user.name}
            </Text>
            <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{t("phone")}</Text>
            <Text style={{ color: colors.charcoal, fontSize: 18, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
              {user.phone}
            </Text>
          </Card>

          <Card>
            <Text style={{ color: colors.charcoal, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
              {t("riderAvailability")}
            </Text>
            <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: spacing.sm }}>
              <StatusButton active={isAvailable} label={t("riderOnline")} onPress={() => setIsAvailable(true)} />
              <StatusButton active={!isAvailable} label={t("riderOffline")} onPress={() => setIsAvailable(false)} />
            </View>
            {user.activeOrderId ? (
              <Text style={{ color: colors.gray, lineHeight: 22, textAlign: isRtl ? "right" : "left" }}>{t("riderBusy")}</Text>
            ) : null}
          </Card>

          <Card>
            <Text style={{ color: colors.charcoal, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
              {t("riderLocation")}
            </Text>
            <Text style={{ color: colors.gray, lineHeight: 22, textAlign: isRtl ? "right" : "left" }}>{t("riderLocationHint")}</Text>
            <Dropdown value={district} onChange={setDistrict} placeholder={t("selectDistrict")} options={riyadhDistricts} />
          </Card>

          <Card>
            <Text style={{ color: colors.charcoal, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
              {t("language")}
            </Text>
            <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: spacing.sm }}>
              <StatusButton active={language === "en"} label={t("english")} onPress={() => setLanguage("en")} />
              <StatusButton active={language === "ar"} label={t("arabic")} onPress={() => setLanguage("ar")} />
            </View>
          </Card>

          <View style={{ gap: spacing.sm }}>
            <PrimaryButton onPress={saveRiderSettings}>{t("saveRiderSettings")}</PrimaryButton>
            <SecondaryButton onPress={logout}>{t("logout")}</SecondaryButton>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{t("profileTitle")}</Title>
      <Card>
        <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{t("name")}</Text>
        <Text style={{ color: colors.charcoal, fontSize: 18, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
          {user?.name || "-"}
        </Text>
        <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{t("phone")}</Text>
        <Text style={{ color: colors.charcoal, fontSize: 18, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
          {user?.phone || "-"}
        </Text>
      </Card>
      <Card>
        <Text style={{ color: colors.charcoal, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
          {t("language")}
        </Text>
        <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: spacing.sm }}>
          <StatusButton active={language === "en"} label={t("english")} onPress={() => setLanguage("en")} />
          <StatusButton active={language === "ar"} label={t("arabic")} onPress={() => setLanguage("ar")} />
        </View>
      </Card>
      <Card>
        <Text style={{ color: colors.charcoal, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
          {t("savedAddresses")}
        </Text>
        <Text style={{ color: colors.gray, lineHeight: 22, textAlign: isRtl ? "right" : "left" }}>{t("savedAddressesBody")}</Text>
      </Card>
      <View style={{ gap: spacing.sm }}>
        <SecondaryButton onPress={() => Alert.alert(t("appName"), t("supportMessage"))}>
          {t("support")}
        </SecondaryButton>
        <PrimaryButton onPress={logout}>{t("logout")}</PrimaryButton>
      </View>
    </Screen>
  );
}

function StatusButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 42,
        minWidth: 110,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.line,
        backgroundColor: active ? colors.primary : colors.white,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.md,
      }}
    >
      <Text style={{ color: active ? colors.white : colors.charcoal, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function Dropdown({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const { isRtl } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <View style={{ gap: spacing.xs }}>
      <Pressable
        onPress={() => setOpen((current) => !current)}
        style={{
          minHeight: 48,
          borderColor: colors.line,
          borderWidth: 1,
          borderRadius: radius.sm,
          backgroundColor: colors.white,
          justifyContent: "center",
          paddingHorizontal: spacing.md,
        }}
      >
        <Text style={{ color: value ? colors.charcoal : colors.gray, fontSize: 16, textAlign: isRtl ? "right" : "left" }}>
          {value || placeholder}
        </Text>
      </Pressable>
      {open ? (
        <View
          style={{
            maxHeight: 260,
            borderColor: colors.line,
            borderWidth: 1,
            borderRadius: radius.sm,
            backgroundColor: colors.white,
            overflow: "hidden",
          }}
        >
          <ScrollView nestedScrollEnabled>
            {options.map((option) => (
              <Pressable
                key={option}
                onPress={() => {
                  onChange(option);
                  setOpen(false);
                }}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  borderBottomColor: colors.line,
                  borderBottomWidth: 1,
                  paddingHorizontal: spacing.md,
                }}
              >
                <Text style={{ color: colors.charcoal, fontWeight: option === value ? "800" : "500", textAlign: isRtl ? "right" : "left" }}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
