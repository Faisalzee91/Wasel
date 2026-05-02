import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";
const TOKEN_KEY = "wasel-token-v1";
const USER_KEY = "wasel-user-v2";

export type AccountRole = "customer" | "rider";
export type OrderStatus = "pending" | "confirmed" | "assigned" | "delivered" | "canceled";

export type Order = {
  id: string;
  pickupAddress: string;
  dropoffAddress: string;
  recipientName: string;
  recipientPhone: string;
  itemCount: number;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  itemDescription: string;
  packageType: string;
  urgency: string;
  paymentMethod: string;
  distanceKm: number;
  price: number;
  status: OrderStatus;
  matchedRiderCount: number;
  pendingRiderCount: number;
  courierId?: string | null;
  courier?: {
    id: string;
    name: string;
    phone: string;
    currentLat?: number | null;
    currentLng?: number | null;
    isAvailable?: boolean;
    activeOrderId?: string | null;
  } | null;
  estimatedDeliveryMinutes: number;
  deliveredAt?: string | null;
  createdAt: string;
};

export type RiderRequest = {
  id: string;
  pickupAddress: string;
  dropoffAddress: string;
  recipientName: string;
  recipientPhone: string;
  itemCount: number;
  itemDescription: string;
  packageType: string;
  urgency: string;
  distanceKm: number;
  distanceToPickupKm: number;
  price: number;
  estimatedDeliveryMinutes: number;
  createdAt: string;
};

export type User = {
  id: string;
  role: AccountRole;
  name: string;
  phone: string;
  isAvailable?: boolean;
  currentLat?: number | null;
  currentLng?: number | null;
  activeOrderId?: string | null;
};

async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

async function saveUser(user: User) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getStoredUser() {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export async function setToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function hasToken() {
  return Boolean(await getToken());
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "request_failed");
    (error as Error & { code?: string }).code = payload.error;
    throw error;
  }

  return payload as T;
}

export async function signup(input: { name: string; phone: string; password: string }) {
  const payload = await apiRequest<{ token: string; user: User }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      name: input.name.trim(),
      phone: input.phone.trim(),
    }),
  });
  await setToken(payload.token);
  await saveUser(payload.user);
  return payload.user;
}

export async function login(input: { phone: string; password: string }) {
  const payload = await apiRequest<{ token: string; user: User }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      phone: input.phone.trim(),
    }),
  });
  await setToken(payload.token);
  await saveUser(payload.user);
  return payload.user;
}

export async function fetchCurrentUser() {
  const payload = await apiRequest<{ user: User }>("/users/me");
  await saveUser(payload.user);
  return payload.user;
}
