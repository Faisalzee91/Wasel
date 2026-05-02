export type RiyadhLocation = {
  district: string;
  lat: number;
  lng: number;
};

export const riyadhLocations: RiyadhLocation[] = [
  { district: "Al Olaya", lat: 24.7116, lng: 46.6753 },
  { district: "Al Sulaimaniyah", lat: 24.7014, lng: 46.6836 },
  { district: "Al Murabba", lat: 24.6505, lng: 46.7101 },
  { district: "Al Wurud", lat: 24.7343, lng: 46.6624 },
  { district: "Al Malaz", lat: 24.6671, lng: 46.7378 },
  { district: "Al Futah", lat: 24.6387, lng: 46.7159 },
  { district: "Al Nakheel", lat: 24.7572, lng: 46.6418 },
  { district: "Al Aqiq", lat: 24.8021, lng: 46.6285 },
  { district: "Al Yasmin", lat: 24.8326, lng: 46.6482 },
  { district: "Al Narjis", lat: 24.8587, lng: 46.6581 },
  { district: "Hittin", lat: 24.7798, lng: 46.6047 },
  { district: "Al Malqa", lat: 24.8094, lng: 46.6032 },
  { district: "Al Rawdah", lat: 24.7515, lng: 46.7613 },
  { district: "Al Hamra", lat: 24.7865, lng: 46.7421 },
  { district: "Qurtubah", lat: 24.8168, lng: 46.7349 },
  { district: "Al Yarmuk", lat: 24.8042, lng: 46.7608 },
  { district: "Al Rimal", lat: 24.8665, lng: 46.7891 },
  { district: "Ishbiliyah", lat: 24.8031, lng: 46.7836 },
  { district: "Al Irqah", lat: 24.7098, lng: 46.6118 },
  { district: "Dhahrat Laban", lat: 24.6376, lng: 46.5712 },
  { district: "Al Suwaidi", lat: 24.5962, lng: 46.6941 },
  { district: "Al Uraija", lat: 24.6128, lng: 46.6435 },
  { district: "Tuwaiq", lat: 24.5709, lng: 46.5534 },
  { district: "Al Badiah", lat: 24.6037, lng: 46.6742 },
  { district: "Al Aziziyah", lat: 24.5836, lng: 46.7471 },
  { district: "Al Mansurah", lat: 24.6233, lng: 46.7428 },
  { district: "Al Dar Al Baida", lat: 24.5431, lng: 46.8015 },
  { district: "Al Shifa", lat: 24.5617, lng: 46.6998 },
  { district: "Badr", lat: 24.5147, lng: 46.7074 },
  { district: "Al Marwah", lat: 24.5482, lng: 46.7446 },
];

export const riyadhDistricts = riyadhLocations.map((location) => location.district);

export function formatRiyadhLocation(district: string) {
  return district ? `${district}, Riyadh` : "";
}

export function getRiyadhLocation(district: string) {
  return riyadhLocations.find((location) => location.district === district) || null;
}

export function getDistrictByCoordinates(lat?: number | null, lng?: number | null) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return "";
  }

  return (
    riyadhLocations.find(
      (location) => Math.abs(location.lat - Number(lat)) < 0.0001 && Math.abs(location.lng - Number(lng)) < 0.0001,
    )?.district || ""
  );
}
