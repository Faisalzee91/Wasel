export const PACKAGE_TYPES = ["documents", "small", "medium", "large"];
export const URGENCY_TYPES = ["standard", "express"];

export const PRICING_RULES = {
  baseFare: 10,
  pricePerKm: 2.5,
  minimumFare: 20,
  expressFlatFee: 15,
  itemCountSurchargeThreshold: 3,
  itemCountSurcharge: 5,
};

export function calculatePrice({ distanceKm = 0, urgency = "standard", itemCount = 1 }) {
  const safeDistance = Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 0;
  const safeItemCount = Number.isFinite(itemCount) && itemCount > 0 ? Math.round(itemCount) : 1;
  const normalPrice = Math.max(
    PRICING_RULES.minimumFare,
    PRICING_RULES.baseFare + safeDistance * PRICING_RULES.pricePerKm,
  );

  const itemSurcharge =
    safeItemCount > PRICING_RULES.itemCountSurchargeThreshold ? PRICING_RULES.itemCountSurcharge : 0;
  const total =
    (urgency === "express" ? normalPrice + PRICING_RULES.expressFlatFee : normalPrice) + itemSurcharge;
  return Math.round(total);
}

export function estimateDeliveryMinutes({ distanceKm = 0, urgency = "standard" }) {
  const safeDistance = Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 0;
  const baseMinutes = urgency === "express" ? 22 : 35;
  const perKm = urgency === "express" ? 4 : 6;
  return Math.max(baseMinutes, Math.round(baseMinutes + safeDistance * perKm));
}
