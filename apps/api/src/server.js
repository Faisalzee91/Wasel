import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import { z } from "zod";
import { config } from "./config.js";
import { calculateDistanceKm } from "./geo.js";
import { calculatePrice, estimateDeliveryMinutes, PACKAGE_TYPES, PRICING_RULES, URGENCY_TYPES } from "./pricing.js";
import { createStore } from "./store.js";

const app = express();
const store = createStore(config.databaseUrl);

const MATCH_RADIUS_KM = 10;
const MAX_RIDER_NOTIFICATIONS = 6;
const ORDER_STATUSES = ["pending", "confirmed", "assigned", "delivered", "canceled"];
const PAYMENT_METHODS = ["stcpay", "bank_transfer", "apple_pay"];

const isTest = process.env.NODE_ENV === "test";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests" },
});

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests" },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests" },
});

app.set("trust proxy", 1);
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

const signupSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  password: z.string().min(6),
});

const loginSchema = z.object({
  phone: z.string().min(8),
  password: z.string().min(6),
});

const forgotPasswordSchema = z.object({
  phone: z.string().min(8),
});

const resetPasswordSchema = z.object({
  phone: z.string().min(8),
  otp: z.string().trim().regex(/^\d{4,8}$/),
  password: z.string().min(6),
});

const orderSchema = z.object({
  pickupAddress: z.string().min(3),
  dropoffAddress: z.string().min(3),
  pickupLat: z.number().finite(),
  pickupLng: z.number().finite(),
  dropoffLat: z.number().finite(),
  dropoffLng: z.number().finite(),
  recipientName: z.string().min(2),
  recipientPhone: z.string().min(8),
  itemCount: z.number().int().min(1).max(25).default(1),
  itemDescription: z.string().min(2).optional(),
  packageType: z.enum(PACKAGE_TYPES).default("small"),
  urgency: z.enum(URGENCY_TYPES).default("standard"),
  paymentMethod: z.enum(PAYMENT_METHODS).default("stcpay"),
});

const statusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  courierId: z.string().uuid().nullable().optional(),
});

const riderAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
  currentLat: z.number().finite().optional(),
  currentLng: z.number().finite().optional(),
});

const riderLocationSchema = z.object({
  currentLat: z.number().finite(),
  currentLng: z.number().finite(),
});

const deliveryOtpSchema = z.object({
  otp: z.string().trim().regex(/^\d{4,8}$/),
});

function normalizePhone(phone) {
  return String(phone || "")
    .trim()
    .replace(/[\s()-]+/g, "");
}

function tokenFor(account) {
  return jwt.sign({ sub: account.id, phone: account.phone, role: account.role }, config.jwtSecret, { expiresIn: "30d" });
}

function sendValidationError(res, error) {
  return res.status(400).json({
    error: "validation_error",
    details: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function sendStoreError(res, error) {
  const code = error?.code || error?.message || "internal_error";

  if (code === "order_not_found" || code === "rider_not_found") {
    return res.status(404).json({ error: code });
  }

  if (code === "request_already_assigned") {
    return res.status(409).json({
      error: code,
      message: "This request has already been assigned to another rider.",
    });
  }

  if (code === "request_not_available" || code === "rider_unavailable" || code === "rider_has_active_order" || code === "order_already_delivered") {
    return res.status(409).json({ error: code });
  }

  if (code === "delivery_otp_missing" || code === "delivery_otp_expired" || code === "delivery_otp_invalid") {
    return res.status(409).json({ error: code });
  }

  if (code === "password_reset_otp_missing" || code === "password_reset_otp_expired" || code === "password_reset_otp_invalid") {
    return res.status(409).json({ error: code });
  }

  if (code === "user_not_found") {
    return res.status(404).json({ error: code });
  }

  if (code === "not_assigned_to_rider") {
    return res.status(403).json({ error: code });
  }

  if (code === "not_order_owner") {
    return res.status(403).json({ error: code });
  }

  if (code === "order_not_cancelable") {
    return res.status(409).json({ error: code });
  }

  console.error(error);
  return res.status(500).json({ error: "internal_error" });
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [, token] = header.split(" ");

  if (!token) {
    return res.status(401).json({ error: "missing_token" });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const role = payload.role === "rider" ? "rider" : "customer";
    const account = role === "rider" ? await store.getCourierById(payload.sub) : await store.getUserById(payload.sub);

    if (!account) {
      return res.status(401).json({ error: "invalid_token" });
    }

    req.user = account;
    return next();
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}

function requireAdmin(req, res, next) {
  if (hasAdminAccess(req)) {
    return next();
  }

  return res.status(403).json({ error: "admin_key_required" });
}

function requireCustomer(req, res, next) {
  if (req.user?.role === "customer") {
    return next();
  }

  return res.status(403).json({ error: "customer_account_required" });
}

function requireRider(req, res, next) {
  if (req.user?.role === "rider") {
    return next();
  }

  return res.status(403).json({ error: "rider_account_required" });
}

function hasAdminAccess(req) {
  return Boolean(config.adminApiKey) && req.headers["x-admin-key"] === config.adminApiKey;
}

async function seedDevUser({ enabled, name, phone, password, label }) {
  if (!enabled) return;

  const existing = await store.findUserByPhone(phone);
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, 10);
  await store.createUser({
    name,
    phone,
    passwordHash,
  });

  console.log(`Seeded local ${label} login for ${phone}`);
}

async function seedDevRiders() {
  for (const rider of config.devRiders) {
    const passwordHash = await bcrypt.hash(rider.password, 10);
    await store.createCourier({
      name: rider.name,
      phone: rider.phone,
      passwordHash,
      currentLat: rider.currentLat,
      currentLng: rider.currentLng,
      isAvailable: rider.isAvailable,
    });
  }
}

async function seedDevUsers() {
  await seedDevUser({ ...config.devAdmin, label: "admin" });
  await seedDevUser({ ...config.devCustomer, label: "customer" });
  await seedDevRiders();
}

function buildOrderSummary(input) {
  const distanceKm = calculateDistanceKm(input.pickupLat, input.pickupLng, input.dropoffLat, input.dropoffLng);
  if (distanceKm === null) {
    return null;
  }

  return {
    distanceKm,
    price: calculatePrice({ distanceKm, urgency: input.urgency, itemCount: input.itemCount }),
    estimatedDeliveryMinutes: estimateDeliveryMinutes({ distanceKm, urgency: input.urgency }),
  };
}

async function matchOrderToNearbyRiders(order) {
  if (!order || order.status !== "pending" || order.courierId) {
    return [];
  }

  const couriers = await store.listCouriers({ onlyAvailable: true });

  const rankedCouriers = couriers
    .filter((courier) => !courier.activeOrderId && Number.isFinite(courier.currentLat) && Number.isFinite(courier.currentLng))
    .map((courier) => ({
      courierId: courier.id,
      distanceToPickupKm: calculateDistanceKm(courier.currentLat, courier.currentLng, order.pickupLat, order.pickupLng),
    }))
    .filter((match) => match.distanceToPickupKm !== null)
    .sort((left, right) => left.distanceToPickupKm - right.distanceToPickupKm);

  const nearby = rankedCouriers
    .filter((match) => match.distanceToPickupKm <= MATCH_RADIUS_KM)
    .slice(0, MAX_RIDER_NOTIFICATIONS);

  const matchesToNotify = nearby.length > 0 ? nearby : rankedCouriers.slice(0, MAX_RIDER_NOTIFICATIONS);

  await store.upsertOrderMatches(order.id, matchesToNotify);
  return matchesToNotify;
}

async function retryPendingMatches() {
  const pendingOrders = await store.listPendingOrders();
  for (const order of pendingOrders) {
    await matchOrderToNearbyRiders(order);
  }
}

function canAccessOrder(req, order) {
  if (!order) return false;
  if (hasAdminAccess(req)) return true;
  if (req.user.role === "customer") return order.userId === req.user.id;
  if (req.user.role === "rider") return order.courierId === req.user.id;
  return false;
}

app.get("/health", (req, res) => {
  res.json({ ok: true, app: "wasel-api", store: store.mode });
});

app.get("/config/pricing", (req, res) => {
  res.json({
    currency: "SAR",
    packageTypes: PACKAGE_TYPES,
    urgencyTypes: URGENCY_TYPES,
    paymentMethods: PAYMENT_METHODS,
    rules: {
      ...PRICING_RULES,
      matchRadiusKm: MATCH_RADIUS_KM,
      maxRiderNotifications: MAX_RIDER_NOTIFICATIONS,
    },
  });
});

app.post("/auth/signup", signupLimiter, async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  const phone = normalizePhone(parsed.data.phone);
  const existing = await store.findUserByPhone(phone);
  if (existing) {
    return res.status(409).json({ error: "phone_already_registered" });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await store.createUser({ ...parsed.data, phone, passwordHash });
  return res.status(201).json({ user, token: tokenFor(user) });
});

app.post("/auth/rider-signup", signupLimiter, async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  const phone = normalizePhone(parsed.data.phone);

  const existingCustomer = await store.findUserByPhone(phone);
  if (existingCustomer) {
    return res.status(409).json({ error: "phone_already_registered" });
  }

  const existingRider = await store.findCourierByPhone(phone);
  if (existingRider) {
    return res.status(409).json({ error: "phone_already_registered" });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await store.createCourier({ name: parsed.data.name, phone, passwordHash });
  return res.status(201).json({ user, token: tokenFor(user) });
});

app.post("/auth/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  const phone = normalizePhone(parsed.data.phone);
  const customer = await store.findUserByPhone(phone);
  if (customer) {
    const isValid = await bcrypt.compare(parsed.data.password, customer.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const user = await store.getUserById(customer.id);
    return res.json({ user, token: tokenFor(user) });
  }

  const rider = await store.findCourierByPhone(phone);
  if (rider) {
    const isValid = await bcrypt.compare(parsed.data.password, rider.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const user = await store.getCourierById(rider.id);
    return res.json({ user, token: tokenFor(user) });
  }

  return res.status(401).json({ error: "invalid_credentials" });
});

app.post("/auth/forgot-password", forgotPasswordLimiter, async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  const phone = normalizePhone(parsed.data.phone);
  const otp = await store.requestPasswordResetOtp(phone);

  if (otp) {
    console.log(`[Wasel OTP] Password reset OTP for ${otp.recipientPhone}: ${otp.code} (expires ${otp.expiresAt})`);
  }

  return res.json({ ok: true });
});

app.post("/auth/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  const phone = normalizePhone(parsed.data.phone);

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    await store.resetPasswordWithOtp(phone, parsed.data.otp, passwordHash);
    return res.json({ ok: true });
  } catch (error) {
    return sendStoreError(res, error);
  }
});

app.get("/users/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

app.post("/users/push-token", authenticate, requireCustomer, async (req, res) => {
  const parsed = z.object({ pushToken: z.string().min(8) }).safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  const user = await store.savePushToken(req.user.id, parsed.data.pushToken);
  return res.json({ user });
});

app.post("/orders", authenticate, requireCustomer, async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  const summary = buildOrderSummary(parsed.data);
  if (!summary) {
    return res.status(400).json({ error: "invalid_distance_coordinates" });
  }

  const itemDescription = parsed.data.itemDescription || `${parsed.data.packageType} package`;
  const order = await store.createOrder({
    userId: req.user.id,
    ...parsed.data,
    itemDescription,
    ...summary,
  });

  return res.status(201).json({ order });
});

app.get("/orders", authenticate, async (req, res) => {
  const includeAll = req.query.admin === "true";
  if (includeAll && !hasAdminAccess(req)) {
    return res.status(403).json({ error: "admin_key_required" });
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  if (req.user.role === "rider" && !includeAll) {
    const orders = await store.listCourierHistory(req.user.id);
    return res.json({ orders });
  }

  const result = await store.listOrders({ userId: req.user.id, includeAll, page, limit });
  return res.json(result);
});

app.get("/orders/:id", authenticate, async (req, res) => {
  const order = await store.getOrderById(req.params.id);
  if (!canAccessOrder(req, order)) {
    return res.status(404).json({ error: "order_not_found" });
  }

  return res.json({ order });
});

app.post("/orders/:id/payment", authenticate, requireCustomer, async (req, res) => {
  const parsed = z.object({ paymentMethod: z.enum(PAYMENT_METHODS) }).safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  const existingOrder = await store.getOrderById(req.params.id);
  if (!existingOrder || existingOrder.userId !== req.user.id) {
    return res.status(404).json({ error: "order_not_found" });
  }

  await store.updateOrder(req.params.id, {
    paymentMethod: parsed.data.paymentMethod,
    status: "pending",
  });

  const nearbyRiders = await matchOrderToNearbyRiders(existingOrder);
  const order = await store.getOrderById(req.params.id);

  return res.json({
    order,
    nearbyRiders: nearbyRiders.length,
  });
});

app.post("/orders/:id/accept", authenticate, requireRider, async (req, res) => {
  try {
    const order = await store.acceptOrder(req.params.id, req.user.id);
    return res.json({ order });
  } catch (error) {
    return sendStoreError(res, error);
  }
});

app.post("/orders/:id/reject", authenticate, requireRider, async (req, res) => {
  try {
    await store.rejectOrderForCourier(req.params.id, req.user.id);
    return res.json({ ok: true });
  } catch (error) {
    return sendStoreError(res, error);
  }
});

app.post("/orders/:id/cancel", authenticate, requireCustomer, async (req, res) => {
  try {
    const order = await store.cancelOrder(req.params.id, req.user.id);
    return res.json({ order });
  } catch (error) {
    return sendStoreError(res, error);
  }
});

app.post("/orders/:id/delivery-otp", authenticate, requireRider, async (req, res) => {
  try {
    const otp = await store.requestDeliveryOtp(req.params.id, req.user.id);
    console.log(`[Wasel OTP] Delivery OTP for ${otp.recipientPhone}: ${otp.code} (expires ${otp.expiresAt})`);
    return res.json({ ok: true, recipientPhone: otp.recipientPhone, expiresAt: otp.expiresAt });
  } catch (error) {
    return sendStoreError(res, error);
  }
});

app.post("/orders/:id/delivered", authenticate, requireRider, async (req, res) => {
  const parsed = deliveryOtpSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  try {
    const order = await store.markOrderDeliveredWithOtp(req.params.id, req.user.id, parsed.data.otp);
    return res.json({ order });
  } catch (error) {
    return sendStoreError(res, error);
  }
});

app.patch("/orders/:id/status", authenticate, requireAdmin, async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  const existingOrder = await store.getOrderById(req.params.id);
  if (!existingOrder) {
    return res.status(404).json({ error: "order_not_found" });
  }

  const patch = { ...parsed.data };

  if (patch.status === "assigned" && !patch.courierId) {
    const availableCouriers = await store.listCouriers({ onlyAvailable: true });
    patch.courierId = availableCouriers.find((courier) => !courier.activeOrderId)?.id ?? null;
    if (!patch.courierId) {
      return res.status(409).json({ error: "no_available_rider" });
    }
  }

  if (patch.status === "delivered") {
    patch.deliveredAt = new Date().toISOString();
  }

  const order = await store.updateOrder(req.params.id, patch);

  if (existingOrder.courierId && existingOrder.courierId !== patch.courierId) {
    await store.updateCourier(existingOrder.courierId, { activeOrderId: null });
  }

  if (order?.courierId && order.status === "assigned") {
    await store.updateCourier(order.courierId, { activeOrderId: order.id });
  }

  if (order?.courierId && (order.status === "delivered" || order.status === "canceled" || order.status === "pending")) {
    await store.updateCourier(order.courierId, { activeOrderId: null });
  }

  return res.json({ order });
});

app.get("/couriers", authenticate, requireAdmin, async (req, res) => {
  const couriers = await store.listCouriers();
  res.json({ couriers });
});

app.get("/rider/available-requests", authenticate, requireRider, async (req, res) => {
  const requests = await store.listAvailableRequestsForCourier(req.user.id);
  res.json({ requests });
});

app.get("/rider/current-delivery", authenticate, requireRider, async (req, res) => {
  const order = await store.getCurrentDeliveryForCourier(req.user.id);
  res.json({ order });
});

app.get("/rider/history", authenticate, requireRider, async (req, res) => {
  const orders = await store.listCourierHistory(req.user.id);
  res.json({ orders });
});

app.patch("/rider/availability", authenticate, requireRider, async (req, res) => {
  const parsed = riderAvailabilitySchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  const courier = await store.updateCourier(req.user.id, {
    isAvailable: parsed.data.isAvailable,
    currentLat: parsed.data.currentLat ?? req.user.currentLat ?? null,
    currentLng: parsed.data.currentLng ?? req.user.currentLng ?? null,
  });

  if (courier?.isAvailable && !courier.activeOrderId) {
    await retryPendingMatches();
  }

  return res.json({ rider: courier });
});

app.patch("/rider/location", authenticate, requireRider, async (req, res) => {
  const parsed = riderLocationSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  const courier = await store.updateCourier(req.user.id, {
    currentLat: parsed.data.currentLat,
    currentLng: parsed.data.currentLng,
  });

  if (courier?.isAvailable && !courier.activeOrderId) {
    await retryPendingMatches();
  }

  return res.json({ rider: courier });
});

// ── Stripe Payments ───────────────────────────────────────────────────────────

function getOrderRef(id) {
  return `WSL-${id.replace(/-/g, "").slice(-4).toUpperCase()}`;
}

function getStripe() {
  if (!config.stripeSecretKey) throw new Error("stripe_not_configured");
  return new Stripe(config.stripeSecretKey, { apiVersion: "2024-04-10" });
}

app.post("/orders/:id/payment/stripe/initiate", authenticate, requireCustomer, async (req, res) => {
  const order = await store.getOrderById(req.params.id);
  if (!order || order.userId !== req.user.id) {
    return res.status(404).json({ error: "order_not_found" });
  }
  if (order.status !== "pending") {
    return res.status(409).json({ error: "order_already_paid" });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "sar",
            unit_amount: Math.round(order.price * 100),
            product_data: {
              name: `Wasel Delivery — ${getOrderRef(order.id)}`,
              description: `${order.pickupAddress} → ${order.dropoffAddress}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${config.apiBaseUrl}/stripe/callback?session_id={CHECKOUT_SESSION_ID}&orderId=${order.id}&result=success`,
      cancel_url: `${config.apiBaseUrl}/stripe/callback?orderId=${order.id}&result=cancel`,
      metadata: { orderId: order.id },
      customer_email: undefined,
    });

    return res.json({ sessionId: session.id, paymentUrl: session.url });
  } catch (error) {
    const code = error?.message || "stripe_error";
    if (code === "stripe_not_configured") {
      return res.status(503).json({ error: "stripe_not_configured" });
    }
    console.error("[Stripe] initiate error", error);
    return res.status(502).json({ error: "stripe_charge_failed" });
  }
});

app.get("/stripe/callback", (req, res) => {
  const { session_id, orderId, result } = req.query;

  if (result === "cancel" || !orderId) {
    return res.redirect(`wasel://payment/result?paid=false&orderId=${orderId || ""}&reason=CANCELLED`);
  }

  if (!session_id) {
    return res.redirect(`wasel://payment/result?paid=false&orderId=${orderId}&reason=MISSING_SESSION`);
  }

  // Redirect immediately — mobile verifies and finalises via /stripe/confirm
  return res.redirect(`wasel://payment/result?session_id=${session_id}&orderId=${orderId}`);
});

app.post("/orders/:id/payment/stripe/confirm", authenticate, requireCustomer, async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "missing_session_id" });

  const order = await store.getOrderById(req.params.id);
  if (!order || order.userId !== req.user.id) {
    return res.status(404).json({ error: "order_not_found" });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      if (order.status === "pending") {
        await store.updateOrder(req.params.id, { paymentMethod: "stcpay", status: "pending" });
        await matchOrderToNearbyRiders(order);
      }
      return res.json({ paid: true });
    }

    return res.json({ paid: false, reason: "DECLINED" });
  } catch (error) {
    console.error("[Stripe] confirm error", error);
    return res.status(502).json({ error: "stripe_confirm_failed" });
  }
});

app.get("/orders/:id/payment/stripe/status", authenticate, requireCustomer, async (req, res) => {
  const order = await store.getOrderById(req.params.id);
  if (!order || order.userId !== req.user.id) {
    return res.status(404).json({ error: "order_not_found" });
  }
  const paid = order.status === "pending" && Boolean(order.paymentMethod);
  return res.json({ paid, status: order.status });
});

// ── Error handler ──────────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

export { app, store };

const isMain = process.argv[1] && new URL(process.argv[1], "file://").pathname === new URL(import.meta.url).pathname;

if (isMain) {
  await seedDevUsers();

  app.listen(config.port, () => {
    console.log(`Wasel API listening on http://localhost:${config.port}`);
  });
}
