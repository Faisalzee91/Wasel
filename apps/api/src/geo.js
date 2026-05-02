const EARTH_RADIUS_KM = 6371;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function calculateDistanceKm(startLat, startLng, endLat, endLng) {
  if (![startLat, startLng, endLat, endLng].every((value) => Number.isFinite(value))) {
    return null;
  }

  const dLat = toRadians(endLat - startLat);
  const dLng = toRadians(endLng - startLng);
  const originLat = toRadians(startLat);
  const destinationLat = toRadians(endLat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(dLng / 2) ** 2;

  return Number((EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}
