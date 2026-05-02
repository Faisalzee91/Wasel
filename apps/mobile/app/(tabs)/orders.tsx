import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Card, Pill, Screen, Title } from "../../components/ui";
import { apiRequest, fetchCurrentUser, Order, User } from "../../lib/api";
import { useLanguage } from "../../lib/i18n";
import { colors, spacing } from "../../lib/theme";

export default function OrdersScreen() {
  const { isRtl, t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

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

  const title = user?.role === "rider" ? t("riderOrdersTitle") : t("ordersTitle");
  const emptyCopy = user?.role === "rider" ? t("riderOrdersEmpty") : t("ordersEmpty");

  return (
    <Screen>
      <Title>{title}</Title>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.sm }}
        ListEmptyComponent={
          <Card>
            <Text style={{ color: colors.gray, textAlign: isRtl ? "right" : "left" }}>{emptyCopy}</Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/order/${item.id}`)}>
            <Card>
              <View style={{ flexDirection: isRtl ? "row-reverse" : "row", justifyContent: "space-between", gap: spacing.sm }}>
                <Text style={{ color: colors.charcoal, fontSize: 16, fontWeight: "700", flex: 1, textAlign: isRtl ? "right" : "left" }}>
                  {item.itemDescription}
                </Text>
                <Pill>{t(item.status)}</Pill>
              </View>
              <Text style={{ color: colors.gray, lineHeight: 22, textAlign: isRtl ? "right" : "left" }}>
                {item.pickupAddress} {isRtl ? "إلى" : "to"} {item.dropoffAddress}
              </Text>
              <Text style={{ color: colors.primary, fontWeight: "700", textAlign: isRtl ? "right" : "left" }}>
                {item.price} {t("sar")}
              </Text>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}
