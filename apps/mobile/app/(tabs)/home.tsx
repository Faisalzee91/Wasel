import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { apiRequest, fetchCurrentUser, Order, RiderRequest, User } from "../../lib/api";
import { Card, Pill, PrimaryButton, Screen, SecondaryButton, Title } from "../../components/ui";
import { colors, spacing } from "../../lib/theme";
import { useLanguage } from "../../lib/i18n";

function formatKm(value: number) {
  return `${value.toFixed(1)}`;
}

export default function HomeScreen() {
  const { isRtl, t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [requests, setRequests] = useState<RiderRequest[]>([]);
  const [currentDelivery, setCurrentDelivery] = useState<Order | null>(null);

  useEffect(() => {
    if (user?.role !== "rider" || !user.isAvailable) {
      return undefined;
    }

    let active = true;
    let subscription: Location.LocationSubscription | null = null;

    async function startTracking() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("locationPermissionTitle"), t("locationPermissionBody"));
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 250,
          timeInterval: 10000,
        },
        async (position) => {
          if (!active) return;

          const currentLat = Number(position.coords.latitude.toFixed(6));
          const currentLng = Number(position.coords.longitude.toFixed(6));

          setUser((current) =>
            current ? { ...current, currentLat, currentLng } : current,
          );

          try {
            await apiRequest<{ rider: User }>("/rider/location", {
              method: "PATCH",
              body: JSON.stringify({ currentLat, currentLng }),
            });
          } catch {}
        },
      );
    }

    void startTracking();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [t, user?.id, user?.isAvailable, user?.role]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        try {
          const account = await fetchCurrentUser();
          if (!active) return;
          setUser(account);

          if (account.role === "rider") {
            const [requestsPayload, currentPayload] = await Promise.all([
              apiRequest<{ requests: RiderRequest[] }>("/rider/available-requests"),
              apiRequest<{ order: Order | null }>("/rider/current-delivery"),
            ]);

            if (!active) return;
            setRequests(requestsPayload.requests);
            setCurrentDelivery(currentPayload.order);
            setOrders([]);
            return;
          }

          const payload = await apiRequest<{ orders: Order[] }>("/orders");
          if (!active) return;
          setOrders(payload.orders.slice(0, 3));
          setRequests([]);
          setCurrentDelivery(null);
        } catch {
          if (!active) return;
          setOrders([]);
          setRequests([]);
          setCurrentDelivery(null);
        }
      }

      void load();
      const timer = setInterval(() => {
        void load();
      }, 8000);

      return () => {
        active = false;
        clearInterval(timer);
      };
    }, []),
  );

  async function acceptRequest(orderId: string) {
    try {
      await apiRequest(`/orders/${orderId}/accept`, { method: "POST" });
      const [account, requestsPayload, currentPayload] = await Promise.all([
        fetchCurrentUser(),
        apiRequest<{ requests: RiderRequest[] }>("/rider/available-requests"),
        apiRequest<{ order: Order | null }>("/rider/current-delivery"),
      ]);
      setUser(account);
      setRequests(requestsPayload.requests);
      setCurrentDelivery(currentPayload.order);
    } catch (error) {
      Alert.alert(t("appName"), error instanceof Error ? error.message : "Request could not be accepted.");
    }
  }

  async function rejectRequest(orderId: string) {
    try {
      await apiRequest(`/orders/${orderId}/reject`, { method: "POST" });
      const payload = await apiRequest<{ requests: RiderRequest[] }>("/rider/available-requests");
      setRequests(payload.requests);
    } catch {
      Alert.alert(t("appName"), "Request could not be rejected.");
    }
  }

  async function markDelivered(orderId: string) {
    try {
      await apiRequest(`/orders/${orderId}/delivered`, { method: "POST" });
      const [account, requestsPayload, currentPayload] = await Promise.all([
        fetchCurrentUser(),
        apiRequest<{ requests: RiderRequest[] }>("/rider/available-requests"),
        apiRequest<{ order: Order | null }>("/rider/current-delivery"),
      ]);
      setUser(account);
      setRequests(requestsPayload.requests);
      setCurrentDelivery(currentPayload.order);
    } catch (error) {
      Alert.alert(t("appName"), error instanceof Error ? error.message : "Delivery could not be completed.");
    }
  }

  if (user?.role === "rider") {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: spacing.sm }}>
            <Title>{t("riderHomeTitle")}</Title>
            <Text style={{ color: colors.gray, fontSize: 15, lineHeight: 23, textAlign: isRtl ? "right" : "left" }}>
              {t("riderHomeSubtitle")}
            </Text>
          </View>

          <Text style={{ color: colors.charcoal, fontSize: 18, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
            {t("currentDelivery")}
          </Text>
          {currentDelivery ? (
            <Card>
              <View style={{ flexDirection: isRtl ? "row-reverse" : "row", justifyContent: "space-between", gap: spacing.sm }}>
                <Text style={{ color: colors.charcoal, fontWeight: "800", flex: 1, textAlign: isRtl ? "right" : "left" }}>
                  {currentDelivery.itemDescription}
                </Text>
                <Pill>{t(currentDelivery.status)}</Pill>
              </View>
              <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{currentDelivery.pickupAddress}</Text>
              <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{currentDelivery.dropoffAddress}</Text>
              {currentDelivery.recipientName || currentDelivery.recipientPhone ? (
                <Text style={{ color: colors.charcoal, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
                  {[currentDelivery.recipientName, currentDelivery.recipientPhone].filter(Boolean).join(" · ")}
                </Text>
              ) : null}
              <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>
                {t("itemCount")}: {currentDelivery.itemCount} {currentDelivery.itemCount > 1 ? t("itemsLabel") : t("itemLabel")}
              </Text>
              <Text style={{ color: colors.primary, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
                {t("tripDistance")}: {formatKm(currentDelivery.distanceKm)} {t("km")}
              </Text>
              <Text style={{ color: colors.charcoal, fontSize: 16, fontWeight: "800", textAlign: isRtl ? "right" : "left" }}>
                {t("liveTracking")}
              </Text>
              <LazyTrackingMap
                pickup={{
                  latitude: currentDelivery.pickupLat,
                  longitude: currentDelivery.pickupLng,
                  title: t("customerLocation"),
                  description: currentDelivery.pickupAddress,
                }}
                dropoff={{
                  latitude: currentDelivery.dropoffLat,
                  longitude: currentDelivery.dropoffLng,
                  title: t("destinationLocation"),
                  description: currentDelivery.dropoffAddress,
                }}
                rider={
                  user.currentLat && user.currentLng
                    ? {
                        latitude: user.currentLat,
                        longitude: user.currentLng,
                        title: t("riderLiveLocation"),
                        description: user.name,
                      }
                    : currentDelivery.courier?.currentLat && currentDelivery.courier?.currentLng
                      ? {
                          latitude: currentDelivery.courier.currentLat,
                          longitude: currentDelivery.courier.currentLng,
                          title: t("riderLiveLocation"),
                          description: currentDelivery.courier.name,
                        }
                      : null
                }
              />
              <Text style={{ color: colors.gray, lineHeight: 22, textAlign: isRtl ? "right" : "left" }}>
                {t("pickupDestinationNote")}
              </Text>
              <PrimaryButton onPress={() => markDelivered(currentDelivery.id)}>{t("markDelivered")}</PrimaryButton>
            </Card>
          ) : (
            <Card>
              <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{t("noCurrentDelivery")}</Text>
            </Card>
          )}

          <Text style={{ color: colors.charcoal, fontSize: 18, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
            {t("availableRequests")}
          </Text>
          {!user.isAvailable ? (
            <Card>
              <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{t("riderLocationHint")}</Text>
            </Card>
          ) : null}
          {user.isAvailable && user.activeOrderId ? (
            <Card>
              <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{t("riderBusy")}</Text>
            </Card>
          ) : null}
          {requests.length === 0 ? (
            <Card>
              <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{t("noAvailableRequests")}</Text>
            </Card>
          ) : (
            requests.map((item) => (
              <Card key={item.id}>
                <View style={{ flexDirection: isRtl ? "row-reverse" : "row", justifyContent: "space-between", gap: spacing.sm }}>
                  <Text style={{ color: colors.charcoal, fontWeight: "800", flex: 1, textAlign: isRtl ? "right" : "left" }}>
                    {item.itemDescription}
                  </Text>
                  <Text style={{ color: colors.primary, fontWeight: "800" }}>
                    {item.price} {t("sar")}
                  </Text>
                </View>
                <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{item.pickupAddress}</Text>
                <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{item.dropoffAddress}</Text>
                {item.recipientName || item.recipientPhone ? (
                  <Text style={{ color: colors.charcoal, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
                    {[item.recipientName, item.recipientPhone].filter(Boolean).join(" · ")}
                  </Text>
                ) : null}
                <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>
                  {t("itemCount")}: {item.itemCount} {item.itemCount > 1 ? t("itemsLabel") : t("itemLabel")}
                </Text>
                <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>
                  {t("distanceToPickup")}: {formatKm(item.distanceToPickupKm)} {t("km")}
                </Text>
                <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>
                  {t("tripDistance")}: {formatKm(item.distanceKm)} {t("km")}
                </Text>
                <Text style={{ color: colors.primary, textAlign: isRtl ? "right" : "left" }}>
                  {t("estimatedEarnings")}: {item.price} {t("sar")}
                </Text>
                <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton onPress={() => acceptRequest(item.id)}>{t("acceptRequest")}</PrimaryButton>
                  </View>
                  <View style={{ flex: 1 }}>
                    <SecondaryButton onPress={() => rejectRequest(item.id)}>{t("rejectRequest")}</SecondaryButton>
                  </View>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: spacing.sm }}>
          <Title>{t("homeTitle")}</Title>
          <Text style={{ color: colors.gray, fontSize: 15, lineHeight: 23, textAlign: isRtl ? "right" : "left" }}>
            {t("homeSubtitle")}
          </Text>
        </View>
        <PrimaryButton onPress={() => router.push("/booking")}>{t("createDelivery")}</PrimaryButton>
        <Text style={{ color: colors.charcoal, fontSize: 18, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
          {t("recentOrders")}
        </Text>
        {orders.length === 0 ? (
          <Card>
            <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{t("noOrders")}</Text>
          </Card>
        ) : (
          orders.map((item) => (
            <Pressable key={item.id} onPress={() => router.push(`/order/${item.id}`)}>
              <Card>
                <View style={{ flexDirection: isRtl ? "row-reverse" : "row", justifyContent: "space-between", gap: spacing.sm }}>
                  <Text style={{ color: colors.charcoal, fontWeight: "700", flex: 1, textAlign: isRtl ? "right" : "left" }}>
                    {item.itemDescription}
                  </Text>
                  <Pill>{t(item.status)}</Pill>
                </View>
                <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>
                  {item.pickupAddress} {isRtl ? "إلى" : "to"} {item.dropoffAddress}
                </Text>
                <Text style={{ color: colors.primary, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
                  {item.price} {t("sar")}
                </Text>
              </Card>
            </Pressable>
          ))
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
