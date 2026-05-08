import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest, fetchCurrentUser, Order, User } from "../../lib/api";
import { useLanguage } from "../../lib/i18n";
import { colors, spacing } from "../../lib/theme";

type FilterKey = "all" | "pending" | "assigned" | "delivered";

function getOrderReference(id: string) {
  return `WSL-${id.replace(/-/g, "").slice(-4).toUpperCase()}`;
}

function formatCompactAddress(address: string) {
  const [first, second] = address.split(",");
  return [first, second].filter(Boolean).join(", ").trim();
}

function getRelativeDateLabel(value: string, t: (key: any) => string, isRtl: boolean) {
  const date = new Date(value);
  const today = new Date();
  const midnightToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const midnightDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((midnightToday - midnightDate) / 86400000);

  if (diffDays <= 0) return t("today");
  if (diffDays === 1) return t("yesterday");
  return isRtl ? `قبل ${diffDays} أيام` : `${diffDays} days ago`;
}

function getOrderStatusLabel(order: Order, t: (key: any) => string) {
  if (order.status === "assigned") return t("inTransit");
  return t(order.status);
}

function getStatusTone(status: Order["status"]) {
  if (status === "delivered") return { bg: "#DBF1D9", text: "#21A861", dot: "#2ED474" };
  if (status === "assigned") return { bg: "#E9DDF6", text: "#A172EB", dot: "#A172EB" };
  return { bg: "#EFE3B9", text: "#9A8031", dot: "#9A8031" };
}

export default function OrdersScreen() {
  const { isRtl, t } = useLanguage();
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<FilterKey>(() => {
    if (filterParam === "delivered") return "delivered";
    if (filterParam === "pending") return "pending";
    return "all";
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (filterParam === "delivered") setFilter("delivered");
    else if (filterParam === "pending") setFilter("pending");
  }, [filterParam]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        try {
          const account = await fetchCurrentUser();
          if (!active) return;
          setUser(account);

          const payload =
            account.role === "rider"
              ? await apiRequest<{ orders: Order[] }>("/rider/history")
              : await apiRequest<{ orders: Order[] }>("/orders");

          if (!active) return;
          setOrders(payload.orders);
        } catch {
          if (active) setOrders([]);
        } finally {
          if (active) setLoading(false);
        }
      }

      void load();
      const timer = setInterval(() => {
        void load();
      }, 10000);

      return () => {
        active = false;
        clearInterval(timer);
      };
    }, []),
  );

  const title = user?.role === "rider" ? t("riderOrdersTitle") : "My Orders";
  const visibleOrders = useMemo(() => {
    if (filter === "all") return orders;
    if (filter === "pending") return orders.filter((item) => item.status === "pending" || item.status === "confirmed");
    if (filter === "assigned") return orders.filter((item) => item.status === "assigned");
    return orders.filter((item) => item.status === "delivered");
  }, [filter, orders]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.sand }}>
      <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 96 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: spacing.md, gap: 12 }}>
          <Text style={{ color: "#1C2A25", fontSize: 24, fontWeight: "800", textAlign: isRtl ? "right" : "left" }}>{title}</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {[
              { key: "all" as FilterKey, label: t("all") },
              { key: "pending" as FilterKey, label: t("pending") },
              { key: "assigned" as FilterKey, label: t("inTransit") },
              { key: "delivered" as FilterKey, label: t("delivered") },
            ].map((item) => (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={({ pressed }) => [
                  {
                    minHeight: 40,
                    borderRadius: 20,
                    paddingHorizontal: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: filter === item.key ? colors.primary : "#F8F0DB",
                    borderWidth: 1,
                    borderColor: filter === item.key ? colors.primary : "#D8CCAE",
                  },
                  pressed && { opacity: 0.84 },
                ]}
              >
                <Text style={{ color: filter === item.key ? colors.white : "#5D6D64", fontSize: 13, fontWeight: "800" }}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={{ marginTop: spacing.md, borderTopWidth: 1, borderTopColor: "#D8CCAE", paddingTop: spacing.md, paddingHorizontal: spacing.md }}>
          {loading && orders.length === 0 ? (
            <OrdersSkeleton />
          ) : visibleOrders.length === 0 ? (
            <View
              style={{
                borderRadius: 20,
                borderWidth: 1,
                borderColor: "#D8CCAE",
                backgroundColor: "#FBF5E7",
                padding: spacing.lg,
              }}
            >
              <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{t("ordersEmpty")}</Text>
            </View>
          ) : (
            <View style={{ gap: spacing.md }}>
              {visibleOrders.map((item) => {
                const tone = getStatusTone(item.status);
                return (
                  <Pressable key={item.id} onPress={() => router.push(`/order/${item.id}`)}>
                    <View
                      style={{
                        borderRadius: 22,
                        borderWidth: 1,
                        borderColor: "#D8CCAE",
                        backgroundColor: "#FBF5E7",
                        padding: 14,
                        flexDirection: isRtl ? "row-reverse" : "row",
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 58,
                          height: 58,
                          borderRadius: 18,
                          backgroundColor: "#ECE4CC",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons
                          name={item.packageType === "documents" ? "document-text-outline" : "briefcase-outline"}
                          size={22}
                          color="#6B7F71"
                        />
                      </View>

                      <View style={{ flex: 1, gap: spacing.sm }}>
                        <View style={{ flexDirection: isRtl ? "row-reverse" : "row", justifyContent: "space-between", gap: spacing.sm }}>
                          <Text style={{ color: "#223029", fontSize: 16, fontWeight: "800", textAlign: isRtl ? "right" : "left" }}>
                            {getOrderReference(item.id)}
                          </Text>
                          <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "800" }}>
                            {t("sar")} {item.price}
                          </Text>
                        </View>

                        <Text style={{ color: "#5F7068", fontSize: 13, lineHeight: 19, textAlign: isRtl ? "right" : "left" }}>
                          {formatCompactAddress(item.pickupAddress)}
                        </Text>

                        <View style={{ flexDirection: isRtl ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm }}>
                          <View
                            style={{
                              flexDirection: isRtl ? "row-reverse" : "row",
                              alignItems: "center",
                              gap: spacing.xs,
                              borderRadius: 999,
                              backgroundColor: tone.bg,
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                            }}
                          >
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tone.dot }} />
                            <Text style={{ color: tone.text, fontSize: 13, fontWeight: "800" }}>{getOrderStatusLabel(item, t)}</Text>
                          </View>
                          <Text style={{ color: "#8A968D", fontSize: 12, fontWeight: "600" }}>{getRelativeDateLabel(item.createdAt, t, isRtl)}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OrdersSkeleton() {
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
    <View style={{ gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <Animated.View
          key={i}
          style={{
            height: 90,
            borderRadius: 22,
            backgroundColor: "#E2D9C2",
            opacity,
          }}
        />
      ))}
    </View>
  );
}
