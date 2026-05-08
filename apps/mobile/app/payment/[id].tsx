import Ionicons from "@expo/vector-icons/Ionicons";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Card, PrimaryButton, Screen, SecondaryButton, Title } from "../../components/ui";
import { apiRequest, Order } from "../../lib/api";
import { useLanguage } from "../../lib/i18n";
import { colors, spacing } from "../../lib/theme";

function getOrderRef(id: string) {
  return `WSL-${id.replace(/-/g, "").slice(-4).toUpperCase()}`;
}

export default function PaymentScreen() {
  const { isRtl, t } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingOrder, setFetchingOrder] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiRequest<{ order: Order }>(`/orders/${id}`)
      .then((payload) => setOrder(payload.order))
      .catch(() => setOrder(null))
      .finally(() => setFetchingOrder(false));
  }, [id]);

  async function payWithCard() {
    if (!id || !order) return;
    setError("");

    try {
      setLoading(true);

      const payload = await apiRequest<{ sessionId: string; paymentUrl: string }>(
        `/orders/${id}/payment/stripe/initiate`,
        { method: "POST" },
      );

      if (!payload.paymentUrl) {
        setError(t("paymentFailed"));
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(payload.paymentUrl, "wasel://");

      if (result.type === "success" && result.url) {
        const parsed = Linking.parse(result.url);
        const reason = parsed.queryParams?.reason as string | undefined;

        // Explicit cancel from Stripe cancel_url
        if (reason === "CANCELLED") {
          setError(t("paymentCancelled"));
          return;
        }

        const sessionId = parsed.queryParams?.session_id as string | undefined;
        const returnedOrderId = parsed.queryParams?.orderId as string | undefined;

        if (!sessionId) {
          setError(t("paymentFailed"));
          return;
        }

        // Verify payment with backend
        const confirm = await apiRequest<{ paid: boolean; reason?: string }>(
          `/orders/${returnedOrderId || id}/payment/stripe/confirm`,
          { method: "POST", body: JSON.stringify({ sessionId }) },
        );

        if (confirm.paid) {
          router.replace(`/order/${returnedOrderId || id}`);
          return;
        }

        setError(confirm.reason === "DECLINED" ? t("paymentDeclined") : t("paymentFailed"));
        return;
      }

      if (result.type === "cancel") {
        setError(t("paymentCancelled"));
      }
    } catch {
      setError(t("paymentFailed"));
    } finally {
      setLoading(false);
    }
  }

  if (fetchingOrder) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{t("paymentTitle")}</Title>

      {/* Order summary */}
      <Card>
        <View style={{ flexDirection: isRtl ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.gray, fontSize: 13, textAlign: isRtl ? "right" : "left" }}>
              {t("orderLabel")}
            </Text>
            <Text style={{ color: colors.charcoal, fontSize: 18, fontWeight: "800", textAlign: isRtl ? "right" : "left" }}>
              {order ? getOrderRef(order.id) : "-"}
            </Text>
          </View>
          <View style={{ alignItems: isRtl ? "flex-start" : "flex-end", gap: 4 }}>
            <Text style={{ color: colors.gray, fontSize: 13 }}>{t("pricePreview")}</Text>
            <Text style={{ color: colors.primary, fontSize: 28, fontWeight: "800" }}>
              {order ? `${order.price}` : "-"}{" "}
              <Text style={{ fontSize: 16, fontWeight: "700" }}>{t("sar")}</Text>
            </Text>
          </View>
        </View>
      </Card>

      {/* Payment method card */}
      <Card>
        <Text style={{ color: colors.charcoal, fontSize: 15, fontWeight: "800", textAlign: isRtl ? "right" : "left" }}>
          {t("paymentMethod")}
        </Text>

        {/* Card option — selected */}
        <View
          style={{
            borderRadius: 16,
            borderWidth: 2,
            borderColor: colors.primary,
            backgroundColor: "#EEF4F1",
            padding: spacing.md,
            flexDirection: isRtl ? "row-reverse" : "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="card-outline" size={22} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.charcoal, fontSize: 15, fontWeight: "800", textAlign: isRtl ? "right" : "left" }}>
              {t("payByCard")}
            </Text>
            <Text style={{ color: colors.gray, fontSize: 13, textAlign: isRtl ? "right" : "left" }}>
              {t("payByCardSubtitle")}
            </Text>
          </View>
          <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
        </View>

        {/* Card logos row */}
        <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: spacing.sm, alignItems: "center" }}>
          {["Visa", "Mastercard", "mada", "STCPay"].map((brand) => (
            <View
              key={brand}
              style={{
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.white,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}
            >
              <Text style={{ color: colors.charcoal, fontSize: 11, fontWeight: "700" }}>{brand}</Text>
            </View>
          ))}
        </View>

        {/* Security note */}
        <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: 6, alignItems: "center" }}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.gray} />
          <Text style={{ color: colors.gray, fontSize: 12, lineHeight: 18, flex: 1, textAlign: isRtl ? "right" : "left" }}>
            {t("paymentSecureNote")}
          </Text>
        </View>
      </Card>

      {/* Error */}
      {error ? (
        <View
          style={{
            backgroundColor: "#FDE8E8",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#F5C2C2",
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: "#B91C1C", fontSize: 14, fontWeight: "600", textAlign: isRtl ? "right" : "left" }}>
            {error}
          </Text>
        </View>
      ) : null}

      <PrimaryButton loading={loading} onPress={payWithCard}>
        {loading ? t("processingPayment") : `${t("payNow")} ${order ? `${order.price} ${t("sar")}` : ""}`}
      </PrimaryButton>

      <SecondaryButton onPress={() => router.back()}>{t("backToBooking")}</SecondaryButton>
    </Screen>
  );
}
