import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Alert, Linking, Platform, Text, View } from "react-native";
import { colors, radius, spacing } from "../lib/theme";
import { useLanguage } from "../lib/i18n";

type MapPoint = {
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  color?: string;
};

type TrackingMapProps = {
  pickup: MapPoint;
  dropoff: MapPoint;
  rider?: MapPoint | null;
  height?: number;
};

export function TrackingMap({ pickup, dropoff, rider = null, height = 240 }: TrackingMapProps) {
  const { isRtl, t } = useLanguage();

  if (Platform.OS === "web") {
    return (
      <View
        style={{
          minHeight: height,
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
          Map preview is available on the mobile app.
        </Text>
        <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>
          Pickup: {pickup.title}
        </Text>
        <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>
          Drop-off: {dropoff.title}
        </Text>
        {rider ? (
          <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>
            Rider: {rider.title}
          </Text>
        ) : null}
      </View>
    );
  }

  const points = [pickup, dropoff, rider].filter(Boolean) as MapPoint[];
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const centerLat = latitudes.reduce((sum, value) => sum + value, 0) / latitudes.length;
  const centerLng = longitudes.reduce((sum, value) => sum + value, 0) / longitudes.length;
  const latitudeDelta = Math.max(0.08, Math.max(...latitudes) - Math.min(...latitudes) + 0.05);
  const longitudeDelta = Math.max(0.08, Math.max(...longitudes) - Math.min(...longitudes) + 0.05);

  const routeCoordinates = rider
    ? [
        { latitude: rider.latitude, longitude: rider.longitude },
        { latitude: pickup.latitude, longitude: pickup.longitude },
        { latitude: dropoff.latitude, longitude: dropoff.longitude },
      ]
    : [
        { latitude: pickup.latitude, longitude: pickup.longitude },
        { latitude: dropoff.latitude, longitude: dropoff.longitude },
      ];

  async function openInGoogleMaps() {
    const origin = rider
      ? `${rider.latitude},${rider.longitude}`
      : `${pickup.latitude},${pickup.longitude}`;
    const destination = `${dropoff.latitude},${dropoff.longitude}`;
    const waypoints = rider ? `${pickup.latitude},${pickup.longitude}` : undefined;

    const webUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ""}&travelmode=driving`;

    try {
      await Linking.openURL(webUrl);
    } catch {
      Alert.alert(t("appName"), t("googleMapsOpenError"));
    }
  }

  function promptOpenInGoogleMaps() {
    Alert.alert(t("openInGoogleMaps"), t("openInGoogleMapsBody"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("open"), onPress: () => void openInGoogleMaps() },
    ]);
  }

  return (
    <View
      style={{
        height,
        overflow: "hidden",
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <MapView
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        onPress={promptOpenInGoogleMaps}
        initialRegion={{
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta,
          longitudeDelta,
        }}
        region={{
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta,
          longitudeDelta,
        }}
      >
        <Polyline coordinates={routeCoordinates} strokeColor={colors.primary} strokeWidth={4} />
        <Marker coordinate={{ latitude: pickup.latitude, longitude: pickup.longitude }} title={pickup.title} description={pickup.description} pinColor={pickup.color || colors.warning} />
        <Marker coordinate={{ latitude: dropoff.latitude, longitude: dropoff.longitude }} title={dropoff.title} description={dropoff.description} pinColor={dropoff.color || colors.secondary} />
        {rider ? (
          <Marker
            coordinate={{ latitude: rider.latitude, longitude: rider.longitude }}
            title={rider.title}
            description={rider.description}
            pinColor={rider.color || colors.primary}
          />
        ) : null}
      </MapView>
    </View>
  );
}
