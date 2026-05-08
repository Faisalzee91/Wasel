import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest, fetchCurrentUser, Order, User } from "../../lib/api";
import { useLanguage } from "../../lib/i18n";
import { colors, spacing } from "../../lib/theme";

function getOrderReference(id: string) {
  return `WSL-${id.replace(/-/g, "").slice(-4).toUpperCase()}`;
}

function getTrackStatusLabel(status: Order["status"], t: (key: any) => string) {
  if (status === "assigned") return t("inTransit");
  return t(status);
}

function getTrackSteps(status: Order["status"]) {
  const placed = true;
  const pickedUp = status === "assigned" || status === "delivered";
  const inTransit = status === "assigned";
  const delivered = status === "delivered";
  return { placed, pickedUp, inTransit, delivered };
}

export default function TrackScreen() {
  const { isRtl, t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        try {
          const account = await fetchCurrentUser();
          if (!active) return;
          setUser(account);

          if (account.role === "rider") {
            const payload = await apiRequest<{ order: Order | null }>("/rider/current-delivery");
            if (!active) return;
            setOrder(payload.order);
            return;
          }

          const payload = await apiRequest<{ orders: Order[] }>("/orders");
          if (!active) return;
          const latestActive =
            payload.orders.find((item) => item.status === "assigned" || item.status === "confirmed" || item.status === "pending") ??
            null;
          setOrder(latestActive);
        } catch {
          if (active) setOrder(null);
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

  const steps = useMemo(() => (order ? getTrackSteps(order.status) : null), [order]);

  async function callRider() {
    const phone = order?.courier?.phone;
    if (!phone) return;
    await Linking.openURL(`tel:${phone}`);
  }

  if (!order) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.sand, padding: spacing.md, justifyContent: "center" }}>
        <View
          style={{
            borderRadius: 24,
            borderWidth: 1,
            borderColor: "#D8CCAE",
            backgroundColor: "#FBF5E7",
            padding: 24,
            alignItems: "center",
            gap: 12,
          }}
        >
          <View
            style={{
              width: 74,
              height: 74,
              borderRadius: 37,
              borderWidth: 3,
              borderColor: "#B4B9A9",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#F5F1E2",
            }}
          >
            <Ionicons name="notifications-outline" size={30} color="#A8892E" />
          </View>
          <Text style={{ color: "#1F2C26", fontSize: 22, fontWeight: "800", textAlign: "center" }}>{t("trackTitle")}</Text>
          <Text style={{ color: "#627268", fontSize: 15, lineHeight: 26, textAlign: "center" }}>{t("noTrackOrderBody")}</Text>
          <Pressable
            onPress={() => router.push("/booking")}
            style={({ pressed }) => [
              {
                minHeight: 50,
                alignSelf: "stretch",
                borderRadius: 16,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
              },
              pressed && { opacity: 0.88 },
            ]}
          >
            <Text style={{ color: colors.white, fontSize: 16, fontWeight: "800" }}>{t("createDelivery")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.sand }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 340, position: "relative", overflow: "hidden" }}>
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

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              {
                position: "absolute",
                top: 14,
                left: isRtl ? undefined : 18,
                right: isRtl ? 18 : undefined,
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "rgba(255,255,255,0.92)",
                borderWidth: 1,
                borderColor: "#D8CCAE",
                alignItems: "center",
                justifyContent: "center",
              },
              pressed && { opacity: 0.88 },
            ]}
          >
            <Ionicons name={isRtl ? "chevron-forward" : "chevron-back"} size={20} color="#324D43" />
          </Pressable>

          <View
            style={{
              position: "absolute",
              top: 14,
              right: isRtl ? undefined : 18,
              left: isRtl ? 18 : undefined,
              borderRadius: 18,
              backgroundColor: "rgba(251,245,231,0.96)",
              borderWidth: 1,
              borderColor: "#D8CCAE",
              paddingHorizontal: 14,
              paddingVertical: 10,
              minWidth: 126,
            }}
          >
            <Text style={{ color: "#647369", fontSize: 12, fontWeight: "700" }}>{t("etaShort")}</Text>
            <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "800" }}>
              {order.estimatedDeliveryMinutes} {t("minutes")}
            </Text>
          </View>
        </View>

        <View
          style={{
            marginTop: -14,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            backgroundColor: colors.sand,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
            gap: spacing.md,
          }}
        >
          <View style={{ flexDirection: isRtl ? "row-reverse" : "row", justifyContent: "space-between", gap: spacing.md, alignItems: "flex-start" }}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={{ color: "#6B7B71", fontSize: 13 }}>{t("orderLabel")}</Text>
              <Text style={{ color: "#1B2A24", fontSize: 22, fontWeight: "800" }}>{getOrderReference(order.id)}</Text>
            </View>
            <View
              style={{
                borderRadius: 999,
                backgroundColor: order.status === "delivered" ? "#DBF1D9" : "#E9DDF6",
                paddingHorizontal: 14,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: order.status === "delivered" ? "#21A861" : "#A172EB", fontSize: 13, fontWeight: "800" }}>
                {getTrackStatusLabel(order.status, t)}
              </Text>
            </View>
          </View>

          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: isRtl ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}>
              <TimelineStep label={t("placed")} complete={steps?.placed} active={order.status === "pending" || order.status === "confirmed"} />
              <TimelineLine complete />
              <TimelineStep label={t("pickedUp")} complete={steps?.pickedUp} active={false} />
              <TimelineLine complete={Boolean(steps?.pickedUp)} />
              <TimelineStep label={t("inTransit")} complete={false} active={Boolean(steps?.inTransit)} />
              <TimelineLine complete={Boolean(steps?.delivered)} />
              <TimelineStep label={t("delivered")} complete={Boolean(steps?.delivered)} active={false} />
            </View>
          </View>

          <View
            style={{
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "#D8CCAE",
              backgroundColor: "#FBF5E7",
              padding: 14,
              flexDirection: isRtl ? "row-reverse" : "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: "#E8DEC3",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.primary, fontSize: 24, fontWeight: "800" }}>
                {(order.courier?.name || "R").slice(0, 1).toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: "#1B2A24", fontSize: 16, fontWeight: "800", textAlign: isRtl ? "right" : "left" }}>
                {order.courier?.name || t("rider")}
              </Text>
              <Text style={{ color: "#66766B", fontSize: 13, textAlign: isRtl ? "right" : "left" }}>
                {order.courier?.phone || order.recipientPhone || "Riyadh"}
              </Text>
            </View>

            {order.courier?.phone ? (
              <Pressable
                onPress={callRider}
                style={({ pressed }) => [
                  {
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    borderWidth: 1,
                    borderColor: "#D8CCAE",
                    backgroundColor: "#F4ECD7",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                  pressed && { opacity: 0.88 },
                ]}
              >
                <Ionicons name="call-outline" size={19} color="#EE9D15" />
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TimelineStep({ label, complete, active }: { label: string; complete?: boolean; active?: boolean }) {
  const filled = complete || active;
  return (
    <View style={{ alignItems: "center", width: 58, gap: 6 }}>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          borderWidth: 2.5,
          borderColor: filled ? colors.primary : "#D4CCB8",
          backgroundColor: complete ? colors.primary : "#F9F3E4",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {complete ? (
          <Ionicons name="checkmark" size={14} color={colors.white} />
        ) : (
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: filled ? colors.primary : "#9EA69D" }} />
        )}
      </View>
      <Text style={{ color: filled ? "#1E362C" : "#7B857A", fontSize: 12, fontWeight: "700", textAlign: "center" }}>{label}</Text>
    </View>
  );
}

function TimelineLine({ complete = false }: { complete?: boolean }) {
  return <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: complete ? colors.primary : "#E4DCC6", marginBottom: 24 }} />;
}

function LazyTrackingMap(props: {
  pickup: { latitude: number; longitude: number; title: string; description?: string };
  dropoff: { latitude: number; longitude: number; title: string; description?: string };
  rider?: { latitude: number; longitude: number; title: string; description?: string } | null;
}) {
  const TrackingMap = require("../../components/tracking-map").TrackingMap;
  return <TrackingMap {...props} />;
}
