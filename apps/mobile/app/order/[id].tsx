import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Card, Pill, Screen, SecondaryButton, Title } from "../../components/ui";
import { apiRequest, fetchCurrentUser, Order, User } from "../../lib/api";
import { useLanguage } from "../../lib/i18n";
import { colors, spacing } from "../../lib/theme";

const statusCopyKeys = {
  pending: "pendingCopy",
  confirmed: "confirmedCopy",
  assigned: "assignedCopy",
  delivered: "deliveredCopy",
  canceled: "canceledCopy",
} as const;

const statusKeys = {
  pending: "pending",
  confirmed: "confirmed",
  assigned: "assigned",
  delivered: "delivered",
  canceled: "canceled",
} as const;

export default function OrderDetailScreen() {
  const { isRtl, t } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [canceling, setCanceling] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return undefined;

      let active = true;

      async function loadOrder() {
        try {
          const [payload, currentUser] = await Promise.all([
            apiRequest<{ order: Order }>(`/orders/${id}`),
            fetchCurrentUser(),
          ]);
          if (active) {
            setOrder(payload.order);
            setUser(currentUser);
          }
        } catch {
          if (active) {
            setOrder(null);
            setUser(null);
          }
        }
      }

      void loadOrder();
      const timer = setInterval(() => {
        void loadOrder();
      }, 8000);

      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [id]),
  );

  function confirmCancel() {
    Alert.alert(t("cancelOrderConfirm"), t("cancelOrderConfirmBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("cancelOrder"),
        style: "destructive",
        onPress: async () => {
          if (!id) return;
          try {
            setCanceling(true);
            const payload = await apiRequest<{ order: Order }>(`/orders/${id}/cancel`, { method: "POST" });
            setOrder(payload.order);
            Alert.alert(t("appName"), t("cancelOrderSuccess"));
          } catch {
            Alert.alert(t("appName"), t("cancelOrderError"));
          } finally {
            setCanceling(false);
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
        <Title>{t("orderDetails")}</Title>
        {!order ? (
          <>
            <Card>
              <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{t("loadingOrder")}</Text>
            </Card>
            <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <SecondaryButton onPress={() => router.replace("/(tabs)/home")}>{t("backToHome")}</SecondaryButton>
              </View>
              <View style={{ flex: 1 }}>
                <SecondaryButton onPress={() => router.replace("/(tabs)/orders")}>{t("backToOrders")}</SecondaryButton>
              </View>
            </View>
          </>
        ) : (
          <>
            <Card>
              <View style={{ flexDirection: isRtl ? "row-reverse" : "row", justifyContent: "space-between", gap: spacing.sm }}>
                <Text style={{ color: colors.charcoal, fontSize: 18, fontWeight: "800", flex: 1, textAlign: isRtl ? "right" : "left" }}>
                  {order.itemDescription}
                </Text>
                <Pill>{t(statusKeys[order.status])}</Pill>
              </View>
              <Text style={{ color: colors.gray, lineHeight: 23, textAlign: isRtl ? "right" : "left" }}>
                {t(statusCopyKeys[order.status])}
              </Text>
              {order.status === "pending" ? (
                <Text style={{ color: colors.primary, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
                  {order.matchedRiderCount > 0
                    ? `${t("ridersNotified")}: ${order.matchedRiderCount}`
                    : t("noNearbyRiders")}
                </Text>
              ) : null}
            </Card>

            <Card>
              <Text style={{ color: colors.charcoal, fontSize: 16, fontWeight: "800", textAlign: isRtl ? "right" : "left" }}>
                {t("liveTracking")}
              </Text>
              <LazyTrackingMap
                pickup={{
                  latitude: order.pickupLat,
                  longitude: order.pickupLng,
                  title: t("customerLocation"),
                  description: order.pickupAddress,
                }}
                dropoff={{
                  latitude: order.dropoffLat,
                  longitude: order.dropoffLng,
                  title: t("destinationLocation"),
                  description: order.dropoffAddress,
                }}
                rider={
                  order.courier?.currentLat && order.courier?.currentLng
                    ? {
                        latitude: order.courier.currentLat,
                        longitude: order.courier.currentLng,
                        title: t("riderLiveLocation"),
                        description: order.courier.name,
                      }
                    : null
                }
              />
              <Text style={{ color: colors.gray, lineHeight: 22, textAlign: isRtl ? "right" : "left" }}>
                {t("pickupDestinationNote")}
              </Text>
            </Card>

            <Card>
              <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{t("pickup")}</Text>
              <Text style={{ color: colors.charcoal, fontSize: 16, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
                {order.pickupAddress}
              </Text>
              <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{t("dropoff")}</Text>
              <Text style={{ color: colors.charcoal, fontSize: 16, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
                {order.dropoffAddress}
              </Text>
            </Card>

            <Card>
              <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{t("recipientDetails")}</Text>
              {order.recipientName ? (
                <Text style={{ color: colors.charcoal, fontSize: 16, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
                  {order.recipientName}
                </Text>
              ) : null}
              {order.recipientPhone ? (
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
                  {t("recipientPhone")}: {order.recipientPhone}
                </Text>
              ) : null}
              <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>
                {t("itemCount")}: {order.itemCount} {order.itemCount > 1 ? t("itemsLabel") : t("itemLabel")}
              </Text>
            </Card>

            <Card>
              <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{t("price")}</Text>
              <Text style={{ color: colors.primary, fontSize: 30, fontWeight: "800", textAlign: isRtl ? "right" : "left" }}>
                {order.price} {t("sar")}
              </Text>
              <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>
                {t("tripDistance")}: {order.distanceKm.toFixed(1)} {t("km")}
              </Text>
              <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>
                {t("eta")}: {order.estimatedDeliveryMinutes} {t("minutes")}
              </Text>
            </Card>

            <Card>
              <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{t("rider")}</Text>
              {order.courier ? (
                <>
                  <Text style={{ color: colors.charcoal, fontSize: 18, fontWeight: "800", textAlign: isRtl ? "right" : "left" }}>
                    {order.courier.name}
                  </Text>
                  <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
                    {t("riderPhone")}: {order.courier.phone}
                  </Text>
                  <Text style={{ color: colors.gray, lineHeight: 22, textAlign: isRtl ? "right" : "left" }}>
                    {t("riderAssigned")}
                  </Text>
                </>
              ) : (
                <Text style={{ color: colors.gray, lineHeight: 22, textAlign: isRtl ? "right" : "left" }}>
                  {t("riderPending")}
                </Text>
              )}
            </Card>

            {user?.role === "customer" && order.status === "pending" ? (
              <Pressable
                disabled={canceling}
                onPress={confirmCancel}
                style={({ pressed }) => [
                  {
                    minHeight: 52,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: "#C0392B",
                    backgroundColor: "#FDF3F2",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={{ color: "#C0392B", fontSize: 16, fontWeight: "800" }}>
                  {canceling ? "..." : t("cancelOrder")}
                </Text>
              </Pressable>
            ) : null}

            <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <SecondaryButton
                  onPress={() =>
                    router.replace(user?.role === "rider" ? "/(tabs)/home" : "/(tabs)/home")
                  }
                >
                  {t("backToHome")}
                </SecondaryButton>
              </View>
              <View style={{ flex: 1 }}>
                <SecondaryButton onPress={() => router.replace("/(tabs)/orders")}>{t("backToOrders")}</SecondaryButton>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function LazyTrackingMap(props: {
  pickup: { latitude: number; longitude: number; title: string; description?: string };
  dropoff: { latitude: number; longitude: number; title: string; description?: string };
  rider?: { latitude: number; longitude: number; title: string; description?: string } | null;
}) {
  const TrackingMap = require("../../components/tracking-map").TrackingMap;
  return <TrackingMap {...props} />;
}
