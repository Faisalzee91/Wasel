import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Card, PrimaryButton, Screen, SecondaryButton, Title } from "../../components/ui";
import { apiRequest, Order } from "../../lib/api";
import { MessageKey, useLanguage } from "../../lib/i18n";
import { colors, radius, spacing } from "../../lib/theme";

const paymentMethods = [
  { id: "stcpay", labelKey: "stcpay" },
  { id: "bank_transfer", labelKey: "bankTransfer" },
  { id: "apple_pay", labelKey: "applePay" },
] satisfies Array<{ id: string; labelKey: MessageKey }>;

export default function PaymentScreen() {
  const { isRtl, t } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("stcpay");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiRequest<{ order: Order }>(`/orders/${id}`)
      .then((payload) => setOrder(payload.order))
      .catch(() => setOrder(null));
  }, [id]);

  async function payNow() {
    if (!id) return;

    try {
      setLoading(true);
      await apiRequest<{ order: Order }>(`/orders/${id}/payment`, {
        method: "POST",
        body: JSON.stringify({ paymentMethod }),
      });
      router.replace(`/order/${id}`);
    } catch {
      Alert.alert(t("orderErrorTitle"), t("orderErrorMessage"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Title>{t("paymentTitle")}</Title>
      <Card>
        <Text style={{ color: colors.gray, lineHeight: 22, textAlign: isRtl ? "right" : "left" }}>
          {t("paymentSubtitle")}
        </Text>
        <Text style={{ color: colors.primary, fontSize: 34, fontWeight: "800", textAlign: isRtl ? "right" : "left" }}>
          {order ? `${order.price} ${t("sar")}` : "-"}
        </Text>
      </Card>

      <Card>
        <Text style={{ color: colors.charcoal, fontSize: 15, fontWeight: "800", textAlign: isRtl ? "right" : "left" }}>
          {t("paymentMethod")}
        </Text>
        <View style={{ flexDirection: isRtl ? "row-reverse" : "row", flexWrap: "wrap", gap: spacing.sm }}>
          {paymentMethods.map((method) => {
            const active = paymentMethod === method.id;
            return (
              <Pressable
                key={method.id}
                onPress={() => setPaymentMethod(method.id)}
                style={{
                  minHeight: 42,
                  minWidth: 112,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.line,
                  backgroundColor: active ? colors.primary : colors.white,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: spacing.md,
                }}
              >
                <Text style={{ color: active ? colors.white : colors.charcoal, fontWeight: "800" }}>
                  {t(method.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: colors.gray, lineHeight: 22, textAlign: isRtl ? "right" : "left" }}>
          {t("paymentSecurityNote")}
        </Text>
      </Card>

      <PrimaryButton loading={loading} onPress={payNow}>
        {t("payNow")}
      </PrimaryButton>
      <SecondaryButton onPress={() => router.back()}>{t("backToBooking")}</SecondaryButton>
    </Screen>
  );
}
