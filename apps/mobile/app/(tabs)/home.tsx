import * as Location from "expo-location";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { apiRequest, fetchCurrentUser, Order, RiderRequest, User } from "../../lib/api";
import { Card, Field, Label, Pill, PrimaryButton, Screen, SecondaryButton, Title } from "../../components/ui";
import { colors, radius, spacing } from "../../lib/theme";
import { useLanguage } from "../../lib/i18n";

function formatKm(value: number) {
  return `${value.toFixed(1)}`;
}

function getGreetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return "greetingMorning";
  if (hour < 18) return "greetingAfternoon";
  return "greetingEvening";
}

function getOrderReference(id: string) {
  return `WSL-${id.replace(/-/g, "").slice(-4).toUpperCase()}`;
}

function formatCompactAddress(address: string) {
  const [first, second] = address.split(",");
  return [first, second].filter(Boolean).join(", ").trim();
}

function getStatusPalette(status: Order["status"]) {
  if (status === "delivered") {
    return {
      backgroundColor: "#E7F6EF",
      dotColor: colors.success,
      textColor: colors.success,
    };
  }

  if (status === "assigned") {
    return {
      backgroundColor: "#E9F5F2",
      dotColor: colors.secondary,
      textColor: colors.primary,
    };
  }

  if (status === "pending" || status === "confirmed") {
    return {
      backgroundColor: "#F8EEE0",
      dotColor: colors.warning,
      textColor: colors.warning,
    };
  }

  return {
    backgroundColor: "#EFEAF8",
    dotColor: "#7C55BE",
    textColor: "#7C55BE",
  };
}

export default function HomeScreen() {
  const { isRtl, t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [requests, setRequests] = useState<RiderRequest[]>([]);
  const [currentDelivery, setCurrentDelivery] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [otpVisible, setOtpVisible] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpRecipientPhone, setOtpRecipientPhone] = useState("");

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
        } finally {
          if (active) setLoading(false);
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

  async function requestDeliveryOtp(order: Order) {
    try {
      setOtpLoading(true);
      const payload = await apiRequest<{ ok: boolean; recipientPhone: string }>(`/orders/${order.id}/delivery-otp`, {
        method: "POST",
      });
      setOtpRecipientPhone(payload.recipientPhone || order.recipientPhone || "");
      setOtpCode("");
      setOtpVisible(true);
      Alert.alert(t("appName"), `${t("deliveryOtpSent")}${payload.recipientPhone ? `: ${payload.recipientPhone}` : ""}`);
    } catch (error) {
      Alert.alert(t("appName"), error instanceof Error ? error.message : t("otpRequired"));
    } finally {
      setOtpLoading(false);
    }
  }

  async function markDelivered(orderId: string) {
    if (!otpCode.trim()) {
      Alert.alert(t("appName"), t("otpRequired"));
      return;
    }

    try {
      setOtpSubmitting(true);
      await apiRequest(`/orders/${orderId}/delivered`, { method: "POST", body: JSON.stringify({ otp: otpCode.trim() }) });
      const [account, requestsPayload, currentPayload] = await Promise.all([
        fetchCurrentUser(),
        apiRequest<{ requests: RiderRequest[] }>("/rider/available-requests"),
        apiRequest<{ order: Order | null }>("/rider/current-delivery"),
      ]);
      setUser(account);
      setRequests(requestsPayload.requests);
      setCurrentDelivery(currentPayload.order);
      setOtpVisible(false);
      setOtpCode("");
      setOtpRecipientPhone("");
    } catch (error) {
      const code = (error as Error & { code?: string })?.code;
      if (code === "delivery_otp_invalid") {
        Alert.alert(t("appName"), t("invalidDeliveryOtp"));
      } else if (code === "delivery_otp_expired") {
        Alert.alert(t("appName"), t("expiredDeliveryOtp"));
      } else {
        Alert.alert(t("appName"), error instanceof Error ? error.message : "Delivery could not be completed.");
      }
    } finally {
      setOtpSubmitting(false);
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
              <PrimaryButton loading={otpLoading} onPress={() => requestDeliveryOtp(currentDelivery)}>{t("markDelivered")}</PrimaryButton>
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
        <Modal visible={otpVisible} transparent animationType="fade" onRequestClose={() => setOtpVisible(false)}>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(24, 29, 34, 0.4)",
              justifyContent: "center",
              padding: spacing.md,
            }}
          >
            <View
              style={{
                backgroundColor: colors.white,
                borderRadius: 8,
                borderColor: colors.line,
                borderWidth: 1,
                padding: spacing.md,
                gap: spacing.sm,
              }}
            >
              <Text style={{ color: colors.primary, fontSize: 20, fontWeight: "800", textAlign: isRtl ? "right" : "left" }}>
                {t("deliveryOtpTitle")}
              </Text>
              <Text style={{ color: colors.gray, lineHeight: 22, textAlign: isRtl ? "right" : "left" }}>
                {t("deliveryOtpBody")}
              </Text>
              {otpRecipientPhone ? (
                <Text style={{ color: colors.charcoal, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
                  {otpRecipientPhone}
                </Text>
              ) : null}
              <Label>{t("deliveryOtpField")}</Label>
              <Field
                value={otpCode}
                onChangeText={setOtpCode}
                placeholder={t("deliveryOtpHint")}
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={8}
              />
              <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton loading={otpSubmitting} onPress={() => currentDelivery && markDelivered(currentDelivery.id)}>
                    {t("confirmDeliveryOtp")}
                  </PrimaryButton>
                </View>
                <View style={{ flex: 1 }}>
                  <SecondaryButton onPress={() => currentDelivery && requestDeliveryOtp(currentDelivery)}>
                    {t("resendOtp")}
                  </SecondaryButton>
                </View>
              </View>
              <SecondaryButton
                onPress={() => {
                  setOtpVisible(false);
                  setOtpCode("");
                }}
              >
                {t("cancel")}
              </SecondaryButton>
            </View>
          </View>
        </Modal>
      </Screen>
    );
  }

  const activeOrders = orders.filter((item) => item.status === "pending" || item.status === "confirmed" || item.status === "assigned");
  const deliveredOrders = orders.filter((item) => item.status === "delivered");
  const totalValue = orders.reduce((sum, item) => sum + item.price, 0);
  const recentOrders = orders.slice(0, 6);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }} showsVerticalScrollIndicator={false}>
        <View
          style={{
            flexDirection: isRtl ? "row-reverse" : "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: spacing.md,
          }}
        >
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={{ color: colors.gray, fontSize: 14, fontWeight: "600", textAlign: isRtl ? "right" : "left" }}>
              {t(getGreetingKey())}
            </Text>
            <Text
              style={{
                color: colors.primary,
                fontSize: 28,
                fontWeight: "800",
                lineHeight: 32,
                textAlign: isRtl ? "right" : "left",
              }}
              numberOfLines={2}
            >
              {user?.name || t("homeTitle")}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/(tabs)/profile")}
            style={({ pressed }) => [
              {
                width: 50,
                height: 50,
                borderRadius: 14,
                backgroundColor: colors.primary,
                borderWidth: 1,
                borderColor: "#1F6C59",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: colors.primary,
                shadowOpacity: 0.16,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
              },
              pressed && { opacity: 0.82 },
            ]}
          >
            <Ionicons name="person-outline" size={20} color={colors.white} />
          </Pressable>
        </View>

        <View
          style={{
            backgroundColor: colors.primary,
            borderRadius: 24,
            padding: 20,
            gap: spacing.sm,
            borderWidth: 1,
            borderColor: "#0F725B",
          }}
        >
          <Text style={{ fontSize: 28 }}>{user?.role === "customer" ? "📦" : "🛵"}</Text>
          <View style={{ gap: spacing.sm }}>
            <Text
              style={{
                color: colors.white,
                fontSize: 22,
                fontWeight: "800",
                lineHeight: 26,
                textAlign: isRtl ? "right" : "left",
              }}
            >
              {t("homeHeroTitle")}
            </Text>
            <Text
              style={{
                color: "#D9E9E3",
                fontSize: 14,
                lineHeight: 21,
                textAlign: isRtl ? "right" : "left",
              }}
            >
              {t("homeHeroBody")}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/booking")}
            style={({ pressed }) => [
              {
                alignSelf: isRtl ? "flex-end" : "flex-start",
                minHeight: 48,
                borderRadius: 24,
                backgroundColor: "#16503F",
                paddingHorizontal: 20,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: isRtl ? "row-reverse" : "row",
                gap: spacing.sm,
              },
              pressed && { opacity: 0.88 },
            ]}
          >
            <Text style={{ color: colors.white, fontSize: 16, fontWeight: "800" }}>{t("newOrder")}</Text>
            <Ionicons name={isRtl ? "arrow-back" : "arrow-forward"} size={18} color={colors.white} />
          </Pressable>
        </View>

        <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: spacing.sm }}>
          {[
            { label: t("activeOrders"), value: activeOrders.length, tone: colors.warning, filter: "pending" },
            { label: t("deliveredOrders"), value: deliveredOrders.length, tone: colors.secondary, filter: "delivered" },
          ].map((stat) => (
            <Pressable
              key={stat.label}
              onPress={() => router.push(`/(tabs)/orders?filter=${stat.filter}`)}
              style={({ pressed }) => [
                {
                  flex: 1,
                  minHeight: 88,
                  backgroundColor: "#FBF5E7",
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: "#D8CCAE",
                  paddingHorizontal: 10,
                  paddingVertical: 12,
                  justifyContent: "center",
                  alignItems: "center",
                  gap: spacing.xs,
                },
                pressed && { opacity: 0.72 },
              ]}
            >
              <Text style={{ color: stat.tone, fontSize: 20, fontWeight: "800", textAlign: "center" }}>{stat.value}</Text>
              <Text style={{ color: colors.gray, fontSize: 12, fontWeight: "600", textAlign: "center" }}>{stat.label}</Text>
            </Pressable>
          ))}
        </View>

        <View
          style={{
            flexDirection: isRtl ? "row-reverse" : "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <Text style={{ color: colors.charcoal, fontSize: 18, fontWeight: "800", textAlign: isRtl ? "right" : "left" }}>
            {t("recentOrders")}
          </Text>
          <Pressable onPress={() => router.push("/(tabs)/orders")} style={({ pressed }) => [pressed && { opacity: 0.72 }]}>
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}>
              {t("seeAll")} {isRtl ? "←" : "→"}
            </Text>
          </Pressable>
        </View>

        {loading && orders.length === 0 ? (
          <HomeSkeleton />
        ) : recentOrders.length === 0 ? (
          <Card>
            <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{t("noOrders")}</Text>
          </Card>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingRight: isRtl ? 0 : spacing.xs, paddingLeft: isRtl ? spacing.xs : 0 }}
          >
            {recentOrders.map((item) => {
              const statusPalette = getStatusPalette(item.status);
              return (
                <Pressable key={item.id} onPress={() => router.push(`/order/${item.id}`)}>
                  <View
                    style={{
                      width: 160,
                      minHeight: 122,
                      backgroundColor: "#FBF5E7",
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: "#D8CCAE",
                      padding: 10,
                      justifyContent: "space-between",
                      gap: spacing.xs,
                    }}
                  >
                    <View style={{ gap: spacing.xs }}>
                      <View
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 9,
                          backgroundColor: "#F3EAD9",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons
                          name={item.packageType === "documents" ? "document-text-outline" : "cube-outline"}
                          size={14}
                          color={colors.warning}
                        />
                      </View>
                      <View style={{ gap: spacing.xs }}>
                        <Text style={{ color: colors.charcoal, fontSize: 16, fontWeight: "800" }}>
                          {getOrderReference(item.id)}
                        </Text>
                        <Text
                          style={{ color: colors.gray, fontSize: 11, lineHeight: 16, textAlign: isRtl ? "right" : "left" }}
                          numberOfLines={2}
                        >
                          {formatCompactAddress(item.pickupAddress)}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        alignSelf: isRtl ? "flex-end" : "flex-start",
                        flexDirection: isRtl ? "row-reverse" : "row",
                        alignItems: "center",
                        gap: spacing.xs,
                        borderRadius: 999,
                        backgroundColor: statusPalette.backgroundColor,
                        paddingHorizontal: 9,
                        paddingVertical: 5,
                      }}
                    >
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: statusPalette.dotColor,
                        }}
                      />
                      <Text style={{ color: statusPalette.textColor, fontSize: 11, fontWeight: "800" }}>{t(item.status)}</Text>
                      
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </ScrollView>
    </Screen>
  );
}

function HomeSkeleton() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
      {[1, 2, 3].map((i) => (
        <Animated.View
          key={i}
          style={{
            width: 160,
            height: 122,
            borderRadius: 18,
            backgroundColor: "#E2D9C2",
            opacity,
          }}
        />
      ))}
    </ScrollView>
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
