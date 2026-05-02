const EARTH_RADIUS_KM = 6371;

export const pricingRules = {
  baseFare: 10,
  pricePerKm: 2.5,
  minimumFare: 20,
  expressFlatFee: 15,
  itemCountSurchargeThreshold: 3,
  itemCountSurcharge: 5,
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function calculateDistanceKm(startLat: number, startLng: number, endLat: number, endLng: number) {
  const dLat = toRadians(endLat - startLat);
  const dLng = toRadians(endLng - startLng);
  const originLat = toRadians(startLat);
  const destinationLat = toRadians(endLat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(dLng / 2) ** 2;

  return Number((EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

export function calculateOrderPrice(distanceKm: number, urgency: string, itemCount = 1) {
  const standardPrice = Math.max(pricingRules.minimumFare, pricingRules.baseFare + distanceKm * pricingRules.pricePerKm);
  const itemSurcharge = itemCount > pricingRules.itemCountSurchargeThreshold ? pricingRules.itemCountSurcharge : 0;
  const total = (urgency === "express" ? standardPrice + pricingRules.expressFlatFee : standardPrice) + itemSurcharge;
  return Math.round(total);
}
