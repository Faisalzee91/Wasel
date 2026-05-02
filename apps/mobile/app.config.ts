import type { ExpoConfig } from "expo/config";

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

const config: ExpoConfig = {
  name: "Wasel",
  slug: "wasel",
  scheme: "wasel",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    config: googleMapsApiKey
      ? {
          googleMapsApiKey,
        }
      : undefined,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Wasel uses the rider's live location so customers can track pickups and deliveries in real time.",
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#0A5C4A",
    },
    config: googleMapsApiKey
      ? {
          googleMaps: {
            apiKey: googleMapsApiKey,
          },
        }
      : undefined,
  },
  plugins: ["expo-router", "expo-notifications", "expo-location"],
  extra: {
    router: {
      origin: false,
    },
  },
};

export default config;
