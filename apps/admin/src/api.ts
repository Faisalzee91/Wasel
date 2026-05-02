const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const TOKEN_KEY = "wasel-admin-token";
const ADMIN_KEY = "wasel-admin-key";

export type OrderStatus = "pending" | "confirmed" | "assigned" | "delivered" | "canceled";

export type Order = {
  id: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    phone: string;
  } | null;
  pickupAddress: string;
  dropoffAddress: string;
  recipientName: string;
  recipientPhone: string;
  itemCount: number;
  distanceKm: number;
  itemDescription: string;
  packageType: string;
  urgency: string;
  paymentMethod: string;
  price: number;
  status: OrderStatus;
  matchedRiderCount: number;
  pendingRiderCount: number;
  courierId?: string | null;
  courier?: {
    id: string;
    name: string;
    phone: string;
  } | null;
  estimatedDeliveryMinutes: number;
  deliveredAt?: string | null;
  createdAt: string;
};

export type Courier = {
  id: string;
  name: string;
  phone: string;
  isAvailable?: boolean;
  currentLat?: number | null;
  currentLng?: number | null;
  activeOrderId?: string | null;
};

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function getAdminKey() {
  return localStorage.getItem(ADMIN_KEY) || "";
}

export function saveSession(token: string, adminKey: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ADMIN_KEY, adminKey);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  const adminKey = getAdminKey();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (adminKey) headers.set("x-admin-key", adminKey);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "request_failed");
  return payload as T;
}

export async function login(phone: string, password: string, adminKey: string) {
  const payload = await apiRequest<{ token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone, password }),
  });
  saveSession(payload.token, adminKey);
}
