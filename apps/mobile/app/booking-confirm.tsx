import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import MapView, { MapPressEvent, Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Card, PrimaryButton, Screen, SecondaryButton, Title } from "../components/ui";
import { useLanguage } from "../lib/i18n";
import { colors, radius, spacing } from "../lib/theme";

type SelectedPoint = {
  latitude: number;
  longitude: number;
  address: string;
};

const riyadhRegion = {
  latitude: 24.7136,
  longitude: 46.6753,
  latitudeDelta: 0.18,
  longitudeDelta: 0.18,
};

function decodePoint(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  try {
    return JSON.parse(value) as SelectedPoint;
  } catch {
    return null;
  }
}

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

export default function BookingConfirmScreen() {
  const { isRtl, t } = useLanguage();
  const params = useLocalSearchParams<{
    pickup?: string;
    dropoff?: string;
    pickupMode?: string;
    dropoffMode?: string;
    target?: "pickup" | "dropoff";
    recipientName?: string;
    recipientPhone?: string;
    packageType?: string;
    urgency?: string;
    itemCount?: string;
  }>();

  const [pickupPoint, setPickupPoint] = useState<SelectedPoint | null>(() => decodePoint(params.pickup));
  const [dropoffPoint, setDropoffPoint] = useState<SelectedPoint | null>(() => decodePoint(params.dropoff));
  const [activeTarget, setActiveTarget] = useState<"pickup" | "dropoff">(
    params.target === "pickup" ? "pickup" : "dropoff",
  );
  const [loading, setLoading] = useState(false);

  async function onMapPress(event: MapPressEvent) {
    const latitude = Number(event.nativeEvent.coordinate.latitude.toFixed(6));
    const longitude = Number(event.nativeEvent.coordinate.longitude.toFixed(6));
    const address = await reverseGeocodePoint(latitude, longitude);

    if (activeTarget === "pickup") {
      setPickupPoint({ latitude, longitude, address });
    } else {
      setDropoffPoint({ latitude, longitude, address });
    }
  }

  async function confirmLocation() {
    const targetPoint = activeTarget === "pickup" ? pickupPoint : dropoffPoint;
    if (!targetPoint) {
      return;
    }

    try {
      setLoading(true);
      router.replace({
        pathname: "/booking",
        params: {
          pickup: pickupPoint ? JSON.stringify(pickupPoint) : "",
          dropoff: dropoffPoint ? JSON.stringify(dropoffPoint) : "",
          pickupMode:
            activeTarget === "pickup"
              ? "map"
              : Array.isArray(params.pickupMode)
                ? params.pickupMode[0]
                : params.pickupMode || "",
          dropoffMode:
            activeTarget === "dropoff"
              ? "map"
              : Array.isArray(params.dropoffMode)
                ? params.dropoffMode[0]
                : params.dropoffMode || "",
          recipientName: Array.isArray(params.recipientName) ? params.recipientName[0] : params.recipientName || "",
          recipientPhone: Array.isArray(params.recipientPhone) ? params.recipientPhone[0] : params.recipientPhone || "",
          packageType: Array.isArray(params.packageType) ? params.packageType[0] : params.packageType || "small",
          urgency: Array.isArray(params.urgency) ? params.urgency[0] : params.urgency || "standard",
          itemCount: Array.isArray(params.itemCount) ? params.itemCount[0] : params.itemCount || "1",
        },
      });
    } finally {
      setLoading(false);
    }
  }

  const mapPoints = [pickupPoint, dropoffPoint].filter(Boolean) as SelectedPoint[];
  const mapCenter =
    pickupPoint && dropoffPoint
      ? {
          latitude: (pickupPoint.latitude + dropoffPoint.latitude) / 2,
          longitude: (pickupPoint.longitude + dropoffPoint.longitude) / 2,
        }
      : pickupPoint || dropoffPoint || { latitude: riyadhRegion.latitude, longitude: riyadhRegion.longitude };

  const latitudeDelta =
    mapPoints.length > 1
      ? Math.max(0.06, Math.abs(mapPoints[0].latitude - mapPoints[1].latitude) + 0.05)
      : riyadhRegion.latitudeDelta;
  const longitudeDelta =
    mapPoints.length > 1
      ? Math.max(0.06, Math.abs(mapPoints[0].longitude - mapPoints[1].longitude) + 0.05)
      : riyadhRegion.longitudeDelta;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
        <Title>{t("confirmLocationsTitle")}</Title>

        <Card>
          <Text style={{ color: colors.gray, lineHeight: 22, textAlign: isRtl ? "right" : "left" }}>
            {t("confirmLocationsSubtitle")}
          </Text>

          <Text style={{ color: colors.charcoal, fontWeight: "800", textAlign: isRtl ? "right" : "left" }}>
            {activeTarget === "pickup" ? t("pickupLabel") : t("destinationLabel")}
          </Text>
          <Text style={{ color: colors.gray, lineHeight: 22, textAlign: isRtl ? "right" : "left" }}>
            {activeTarget === "pickup"
              ? pickupPoint?.address || t("pickupSelectionHint")
              : dropoffPoint?.address || t("dropoffSelectionHint")}
          </Text>

          <Text style={{ color: colors.gray, lineHeight: 22, textAlign: isRtl ? "right" : "left" }}>
            {activeTarget === "pickup" ? t("pickupMapHint") : t("dropoffMapHint")}
          </Text>

          <LocationSelectionMap
            center={mapCenter}
            latitudeDelta={latitudeDelta}
            longitudeDelta={longitudeDelta}
            pickup={pickupPoint}
            dropoff={dropoffPoint}
            onPress={onMapPress}
          />
        </Card>

        <PrimaryButton loading={loading} onPress={confirmLocation}>
          {t("confirmLocation")}
        </PrimaryButton>
        <SecondaryButton onPress={() => router.back()}>{t("backToBooking")}</SecondaryButton>
      </ScrollView>
    </Screen>
  );
}

function LocationSelectionMap({
  center,
  latitudeDelta,
  longitudeDelta,
  pickup,
  dropoff,
  onPress,
}: {
  center: { latitude: number; longitude: number };
  latitudeDelta: number;
  longitudeDelta: number;
  pickup: SelectedPoint | null;
  dropoff: SelectedPoint | null;
  onPress: (event: MapPressEvent) => void;
}) {
  const { isRtl, t } = useLanguage();

  if (Platform.OS === "web") {
    return (
      <View
        style={{
          minHeight: 240,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: "#F0F5F3",
          padding: spacing.md,
          gap: spacing.sm,
          justifyContent: "center",
        }}
      >
        <Text style={{ color: colors.primary, fontWeight: "800", textAlign: isRtl ? "right" : "left" }}>
          {t("mapSelectionHint")}
        </Text>
        <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>
          {t("pickupLabel")}: {pickup?.address || t("pickupSelectionHint")}
        </Text>
        <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>
          {t("destinationLabel")}: {dropoff?.address || t("dropoffSelectionHint")}
        </Text>
      </View>
    );
  }

  const routeCoordinates =
    pickup && dropoff
      ? [
          { latitude: pickup.latitude, longitude: pickup.longitude },
          { latitude: dropoff.latitude, longitude: dropoff.longitude },
        ]
      : [];

  return (
    <View
      style={{
        height: 300,
        overflow: "hidden",
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <MapView
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        showsUserLocation
        onPress={onPress}
        region={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta,
          longitudeDelta,
        }}
      >
        {pickup ? (
          <Marker
            coordinate={{ latitude: pickup.latitude, longitude: pickup.longitude }}
            title="Pickup"
            description={pickup.address}
            pinColor={colors.warning}
          />
        ) : null}
        {dropoff ? (
          <Marker
            coordinate={{ latitude: dropoff.latitude, longitude: dropoff.longitude }}
            title="Destination"
            description={dropoff.address}
            pinColor={colors.secondary}
          />
        ) : null}
        {routeCoordinates.length === 2 ? <Polyline coordinates={routeCoordinates} strokeColor={colors.primary} strokeWidth={4} /> : null}
      </MapView>
    </View>
  );
}
