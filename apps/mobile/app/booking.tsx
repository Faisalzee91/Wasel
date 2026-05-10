import * as Location from "expo-location";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Card, Field, Label, PrimaryButton, Screen, Title } from "../components/ui";
import { apiRequest, clearToken, Order } from "../lib/api";
import { MessageKey, useLanguage } from "../lib/i18n";
import { calculateDistanceKm, calculateOrderPrice, pricingRules } from "../lib/pricing";
import { colors, radius, spacing } from "../lib/theme";

const packages = [
  { id: "documents", labelKey: "documents" },
  { id: "small", labelKey: "small" },
  { id: "medium", labelKey: "medium" },
  { id: "large", labelKey: "large" },
] satisfies Array<{ id: string; labelKey: MessageKey }>;

const urgencies = [
  { id: "standard", labelKey: "standard" },
  { id: "express", labelKey: "express" },
] satisfies Array<{ id: string; labelKey: MessageKey }>;

const itemCountOptions = [
  { id: "1", labelKey: "oneItem" },
  { id: "2", labelKey: "twoItems" },
  { id: "3", labelKey: "threeItems" },
  { id: "4", labelKey: "moreItems" },
] satisfies Array<{ id: string; labelKey: MessageKey }>;

type SelectedPoint = {
  latitude: number;
  longitude: number;
  address: string;
};

type SelectionMode = "map" | "current" | null;

function formatFallbackAddress(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

async function reverseGeocodePoint(latitude: number, longitude: number) {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    const best = results[0];
    if (!best) return formatFallbackAddress(latitude, longitude);

    const parts = [best.name, best.street, best.district, best.city].filter(Boolean);
    return parts.length ? Array.from(new Set(parts)).join(", ") : formatFallbackAddress(latitude, longitude);
  } catch {
    return formatFallbackAddress(latitude, longitude);
  }
}

function encodePoint(point: SelectedPoint | null) {
  return point ? JSON.stringify(point) : "";
}

function decodePoint(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  try {
    return JSON.parse(value) as SelectedPoint;
  } catch {
    return null;
  }
}

function readParam(raw: string | string[] | undefined) {
  return Array.isArray(raw) ? raw[0] || "" : raw || "";
}

export default function BookingScreen() {
  const { isRtl, t } = useLanguage();
  const params = useLocalSearchParams<{
    pickup?: string;
    dropoff?: string;
    pickupMode?: string;
    dropoffMode?: string;
    recipientName?: string;
    recipientPhone?: string;
    packageType?: string;
    urgency?: string;
    itemCount?: string;
  }>();
  const [pickupPoint, setPickupPoint] = useState<SelectedPoint | null>(() => decodePoint(params.pickup));
  const [dropoffPoint, setDropoffPoint] = useState<SelectedPoint | null>(() => decodePoint(params.dropoff));
  const [recipientName, setRecipientName] = useState(() => readParam(params.recipientName));
  const [recipientPhone, setRecipientPhone] = useState(() => readParam(params.recipientPhone));
  const [packageType, setPackageType] = useState(() => readParam(params.packageType) || "small");
  const [urgency, setUrgency] = useState(() => readParam(params.urgency) || "standard");
  const [itemCount, setItemCount] = useState(() => Number(readParam(params.itemCount) || "1"));
  const [pickupMode, setPickupMode] = useState<SelectionMode>(() => (readParam(params.pickupMode) === "map" || readParam(params.pickupMode) === "current" ? (readParam(params.pickupMode) as SelectionMode) : null));
  const [dropoffMode, setDropoffMode] = useState<SelectionMode>(() => (readParam(params.dropoffMode) === "map" || readParam(params.dropoffMode) === "current" ? (readParam(params.dropoffMode) as SelectionMode) : null));
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const nextPickup = decodePoint(params.pickup);
    const nextDropoff = decodePoint(params.dropoff);
    if (nextPickup) setPickupPoint(nextPickup);
    if (nextDropoff) setDropoffPoint(nextDropoff);
    const nextRecipientName = readParam(params.recipientName);
    const nextRecipientPhone = readParam(params.recipientPhone);
    const nextPackageType = readParam(params.packageType);
    const nextUrgency = readParam(params.urgency);
    const nextItemCount = readParam(params.itemCount);
    const nextPickupMode = readParam(params.pickupMode);
    const nextDropoffMode = readParam(params.dropoffMode);
    if (nextRecipientName) setRecipientName(nextRecipientName);
    if (nextRecipientPhone) setRecipientPhone(nextRecipientPhone);
    if (nextPackageType) setPackageType(nextPackageType);
    if (nextUrgency) setUrgency(nextUrgency);
    if (nextItemCount) setItemCount(Number(nextItemCount));
    if (nextPickupMode === "map" || nextPickupMode === "current") setPickupMode(nextPickupMode);
    if (nextDropoffMode === "map" || nextDropoffMode === "current") setDropoffMode(nextDropoffMode);
  }, [params.dropoff, params.dropoffMode, params.itemCount, params.packageType, params.pickup, params.pickupMode, params.recipientName, params.recipientPhone, params.urgency]);

  useEffect(() => {
    let active = true;

    async function loadCurrentLocation() {
      if (decodePoint(params.pickup)) {
        if (active) setLoadingLocation(false);
        return;
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (active) {
            setLoadingLocation(false);
            setErrorMessage(t("locationPermissionBody"));
          }
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const latitude = Number(current.coords.latitude.toFixed(6));
        const longitude = Number(current.coords.longitude.toFixed(6));
        const address = await reverseGeocodePoint(latitude, longitude);

        if (!active) return;
        setPickupPoint({ latitude, longitude, address });
      } catch {
        if (active) {
          setErrorMessage(t("locationAutofillError"));
        }
      } finally {
        if (active) {
          setLoadingLocation(false);
        }
      }
    }

    void loadCurrentLocation();

    return () => {
      active = false;
    };
  }, [params.pickup, t]);

  const previewDistance =
    pickupPoint && dropoffPoint
      ? calculateDistanceKm(pickupPoint.latitude, pickupPoint.longitude, dropoffPoint.latitude, dropoffPoint.longitude)
      : 0;

  const previewPrice = useMemo(
    () => calculateOrderPrice(previewDistance, urgency, itemCount),
    [previewDistance, urgency, itemCount],
  );

  async function useCurrentLocationFor(setter: (point: SelectedPoint) => void, setMode: (mode: SelectionMode) => void) {
    try {
      setLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMessage(t("locationPermissionBody"));
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const latitude = Number(current.coords.latitude.toFixed(6));
      const longitude = Number(current.coords.longitude.toFixed(6));
      const address = await reverseGeocodePoint(latitude, longitude);
      setter({ latitude, longitude, address });
      setMode("current");
      setErrorMessage("");
    } catch {
      setErrorMessage(t("locationAutofillError"));
    } finally {
      setLoadingLocation(false);
    }
  }

  function openMapConfirmation(target: "pickup" | "dropoff") {
    router.push({
      pathname: "/booking-confirm",
      params: {
        target,
        pickup: encodePoint(pickupPoint),
        dropoff: encodePoint(dropoffPoint),
        pickupMode: pickupMode || "",
        dropoffMode: dropoffMode || "",
        recipientName,
        recipientPhone,
        packageType,
        urgency,
        itemCount: String(itemCount),
      },
    });
  }

  const selectedPackage = packages.find((item) => item.id === packageType) || packages[1];
  const itemDescription =
    itemCount > 1
      ? `${itemCount} ${t(selectedPackage.labelKey).toLowerCase()} ${t("itemsLabel").toLowerCase()}`
      : `${t(selectedPackage.labelKey)} ${t("itemLabel").toLowerCase()}`;

  async function createOrder() {
    try {
      setLoading(true);
      if (!pickupPoint || !dropoffPoint || !recipientName.trim() || !recipientPhone.trim()) {
        setErrorMessage(t("orderErrorMessage"));
        return;
      }

      const payload = await apiRequest<{ order: Order }>("/orders", {
        method: "POST",
        body: JSON.stringify({
          pickupAddress: pickupPoint.address,
          dropoffAddress: dropoffPoint.address,
          pickupLat: pickupPoint.latitude,
          pickupLng: pickupPoint.longitude,
          dropoffLat: dropoffPoint.latitude,
          dropoffLng: dropoffPoint.longitude,
          recipientName: recipientName.trim(),
          recipientPhone: recipientPhone.trim(),
          itemCount,
          itemDescription,
          packageType,
          urgency,
        }),
      });
      router.push(`/payment/${payload.order.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "invalid_token" || message === "missing_token") {
        await clearToken();
        setErrorMessage("Your session expired. Please log in again.");
        router.replace("/");
        return;
      }
      setErrorMessage(t("orderErrorMessage"));
      Alert.alert(t("orderErrorTitle"), t("orderErrorMessage"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: isRtl ? "row-reverse" : "row", alignItems: "center", gap: spacing.sm }}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              {
                width: 40,
                height: 40,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.white,
                alignItems: "center",
                justifyContent: "center",
              },
              pressed && { opacity: 0.82 },
            ]}
          >
            <Ionicons name={isRtl ? "chevron-forward" : "chevron-back"} size={20} color={colors.primary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Title>{t("bookingTitle")}</Title>
          </View>
        </View>

        <Card>
          <View style={{ gap: spacing.sm }}>
            <Label>{t("pickupLabel")}</Label>
            <Text style={{ color: pickupPoint ? colors.charcoal : colors.gray, lineHeight: 22, textAlign: isRtl ? "right" : "left" }}>
              {pickupPoint ? pickupPoint.address : loadingLocation ? t("detectingCurrentLocation") : t("pickupSelectionHint")}
            </Text>
            <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <ActionButton active={pickupMode === "map"} label={t("setPickupOnMap")} onPress={() => openMapConfirmation("pickup")} />
              </View>
              <View style={{ flex: 1 }}>
                <ActionButton active={pickupMode === "current"} label={t("useCurrentLocation")} onPress={() => void useCurrentLocationFor(setPickupPoint, setPickupMode)} />
              </View>
            </View>

            <Label>{t("dropoffLabel")}</Label>
            <Text style={{ color: dropoffPoint ? colors.charcoal : colors.gray, lineHeight: 22, textAlign: isRtl ? "right" : "left" }}>
              {dropoffPoint ? dropoffPoint.address : t("dropoffSelectionHint")}
            </Text>
            <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <ActionButton active={dropoffMode === "map"} label={t("setDropoffOnMap")} onPress={() => openMapConfirmation("dropoff")} />
              </View>
              <View style={{ flex: 1 }}>
                <ActionButton
                  active={dropoffMode === "current"}
                  label={t("useCurrentLocationForDestination")}
                  onPress={() => void useCurrentLocationFor(setDropoffPoint, setDropoffMode)}
                />
              </View>
            </View>
          </View>
        </Card>

        <Card>
          <Label>{t("recipientDetails")}</Label>
          <Field
            placeholder={t("recipientName")}
            value={recipientName}
            onChangeText={setRecipientName}
            autoCapitalize="words"
          />
          <Field
            placeholder={t("recipientPhone")}
            value={recipientPhone}
            onChangeText={setRecipientPhone}
            keyboardType="phone-pad"
          />
        </Card>

        <Card>
          <Label>{t("packageSize")}</Label>
          <Segmented options={packages} value={packageType} onChange={setPackageType} />
          <Label>{t("itemCount")}</Label>
          <Segmented options={itemCountOptions} value={String(itemCount)} onChange={(value) => setItemCount(Number(value))} />
          <Label>{t("speed")}</Label>
          <Segmented options={urgencies} value={urgency} onChange={setUrgency} />
        </Card>

        <Card>
          <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{t("pricePreview")}</Text>
          <Text style={{ color: colors.primary, fontSize: 34, fontWeight: "800", textAlign: isRtl ? "right" : "left" }}>
            {previewPrice} {t("sar")}
          </Text>
          <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>
            {t("tripDistance")}: {previewDistance.toFixed(1)} {t("km")}
          </Text>
          <Text style={{ color: colors.gray, lineHeight: 22, textAlign: isRtl ? "right" : "left" }}>
            {t("priceNote")}
          </Text>
          {urgency === "express" ? (
            <Text style={{ color: colors.primary, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
              +{pricingRules.expressFlatFee} {t("sar")} {t("expressFeeLabel")}
            </Text>
          ) : null}
          {itemCount > pricingRules.itemCountSurchargeThreshold ? (
            <Text style={{ color: colors.primary, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
              +{pricingRules.itemCountSurcharge} {t("sar")} {t("bulkItemsFeeLabel")}
            </Text>
          ) : null}
        </Card>

        <PrimaryButton loading={loading} onPress={createOrder}>
          {t("confirmOrder")}
        </PrimaryButton>

        {errorMessage ? (
          <Card>
            <Text style={{ color: "#8A3A0A", fontWeight: "800", textAlign: isRtl ? "right" : "left" }}>
              {errorMessage}
            </Text>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function ActionButton({ active = false, label, onPress }: { active?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 42,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.line,
        backgroundColor: active ? colors.primary : colors.white,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.md,
      }}
    >
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: active ? colors.white : colors.charcoal, fontWeight: "800", fontSize: 15 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { id: string; labelKey: MessageKey }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { isRtl, t } = useLanguage();
  return (
    <View style={{ flexDirection: isRtl ? "row-reverse" : "row", flexWrap: "wrap", gap: spacing.sm }}>
      {options.map((option) => {
        const active = value === option.id;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={{
              minHeight: 42,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.line,
              backgroundColor: active ? colors.primary : colors.white,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: spacing.md,
            }}
          >
            <Text style={{ color: active ? colors.white : colors.charcoal, fontWeight: "800" }}>{t(option.labelKey)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
