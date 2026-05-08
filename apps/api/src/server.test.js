/**
 * Wasel API — Vitest + supertest test suite
 * Uses the in-memory store (no DATABASE_URL needed).
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import supertest from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ensure we use the memory store during tests
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "";
process.env.JWT_SECRET = "test-secret-wasel";
process.env.ADMIN_API_KEY = "test-admin-key";
process.env.SEED_DEV_ADMIN = "false";
process.env.SEED_DEV_CUSTOMER = "false";
process.env.SEED_DEV_RIDERS = "false";

// Import app after env vars are set
const { app, store } = await import("./server.js");

const request = supertest(app);

// ─── helpers ────────────────────────────────────────────────────────────────

const ADMIN_HEADERS = { "x-admin-key": "test-admin-key" };

async function seedCustomer({ phone = "+966511111111", password = "pass1234", name = "Test Customer" } = {}) {
  const passwordHash = await bcrypt.hash(password, 1);
  const user = await store.createUser({ name, phone, passwordHash });
  const token = jwt.sign({ sub: user.id, phone: user.phone, role: "customer" }, "test-secret-wasel", { expiresIn: "1h" });
  return { user, token, phone, password };
}

async function seedRider({ phone = "+966522222222", password = "pass1234", name = "Test Rider" } = {}) {
  const passwordHash = await bcrypt.hash(password, 1);
  const rider = await store.createCourier({
    name,
    phone,
    passwordHash,
    currentLat: 24.7136,
    currentLng: 46.6753,
    isAvailable: true,
  });
  const token = jwt.sign({ sub: rider.id, phone: rider.phone, role: "rider" }, "test-secret-wasel", { expiresIn: "1h" });
  return { rider, token, phone, password };
}

const ORDER_BODY = {
  pickupAddress: "123 Main St, Riyadh",
  dropoffAddress: "456 Oak Ave, Riyadh",
  pickupLat: 24.7136,
  pickupLng: 46.6753,
  dropoffLat: 24.7589,
  dropoffLng: 46.6512,
  recipientName: "Bob Smith",
  recipientPhone: "+966533333333",
  itemCount: 1,
  itemDescription: "Small parcel",
  packageType: "small",
  urgency: "standard",
  paymentMethod: "stcpay",
};

// ─── GET /health ─────────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await request.get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.app).toBe("wasel-api");
  });
});

// ─── POST /auth/signup ───────────────────────────────────────────────────────

describe("POST /auth/signup", () => {
  it("creates a customer and returns user + token", async () => {
    const res = await request.post("/auth/signup").send({
      name: "Alice",
      phone: "+966500000010",
      password: "secret123",
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.role).toBe("customer");
    expect(res.body.token).toBeDefined();
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("returns 409 on duplicate phone", async () => {
    const phone = "+966500000011";
    await request.post("/auth/signup").send({ name: "Alice", phone, password: "secret123" });
    const res = await request.post("/auth/signup").send({ name: "Alice2", phone, password: "secret456" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("phone_already_registered");
  });

  it("returns 400 on validation errors", async () => {
    const res = await request.post("/auth/signup").send({ name: "A", phone: "123", password: "x" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it("returns 400 when fields are missing", async () => {
    const res = await request.post("/auth/signup").send({ name: "Alice" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });
});

// ─── POST /auth/rider-signup ─────────────────────────────────────────────────

describe("POST /auth/rider-signup", () => {
  it("creates a rider and returns user + token with role=rider", async () => {
    const res = await request.post("/auth/rider-signup").send({
      name: "Rider Bob",
      phone: "+966500000020",
      password: "secret123",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("rider");
    expect(res.body.token).toBeDefined();
  });

  it("returns 409 when phone already used as customer", async () => {
    const phone = "+966500000021";
    await request.post("/auth/signup").send({ name: "Customer", phone, password: "secret123" });
    const res = await request.post("/auth/rider-signup").send({ name: "Rider", phone, password: "secret123" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("phone_already_registered");
  });

  it("returns 409 when phone already used as rider", async () => {
    const phone = "+966500000022";
    await request.post("/auth/rider-signup").send({ name: "Rider1", phone, password: "secret123" });
    const res = await request.post("/auth/rider-signup").send({ name: "Rider2", phone, password: "pass456" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("phone_already_registered");
  });

  it("returns 400 on validation error", async () => {
    const res = await request.post("/auth/rider-signup").send({ name: "R", phone: "1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });
});

// ─── POST /auth/login ────────────────────────────────────────────────────────

describe("POST /auth/login", () => {
  it("logs in a customer successfully", async () => {
    const { phone, password } = await seedCustomer({ phone: "+966500000030" });

    const res = await request.post("/auth/login").send({ phone, password });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("customer");
    expect(res.body.token).toBeDefined();
  });

  it("logs in a rider successfully", async () => {
    const { phone, password } = await seedRider({ phone: "+966500000031" });

    const res = await request.post("/auth/login").send({ phone, password });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("rider");
    expect(res.body.token).toBeDefined();
  });

  it("returns 401 for wrong password (customer)", async () => {
    const { phone } = await seedCustomer({ phone: "+966500000032" });

    const res = await request.post("/auth/login").send({ phone, password: "wrongpassword" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_credentials");
  });

  it("returns 401 for unknown phone", async () => {
    const res = await request.post("/auth/login").send({ phone: "+966599999999", password: "anything" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_credentials");
  });

  it("returns 400 on validation error", async () => {
    const res = await request.post("/auth/login").send({ phone: "123" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });
});

// ─── POST /auth/forgot-password & POST /auth/reset-password ─────────────────

describe("POST /auth/forgot-password and reset-password (OTP flow)", () => {
  it("returns ok for known phone (does not reveal user existence)", async () => {
    const { phone } = await seedCustomer({ phone: "+966500000040" });

    const res = await request.post("/auth/forgot-password").send({ phone });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("returns ok for unknown phone (does not reveal user existence)", async () => {
    const res = await request.post("/auth/forgot-password").send({ phone: "+966500000041" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("resets password with valid OTP", async () => {
    const phone = "+966500000042";
    const { password: originalPassword } = await seedCustomer({ phone });

    // Request OTP and capture the code via store spy
    const otpResult = await store.requestPasswordResetOtp(phone);
    expect(otpResult).not.toBeNull();
    const code = otpResult.code;

    const res = await request.post("/auth/reset-password").send({
      phone,
      otp: code,
      password: "newpassword123",
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Verify old password no longer works
    const loginOld = await request.post("/auth/login").send({ phone, password: originalPassword });
    expect(loginOld.status).toBe(401);

    // Verify new password works
    const loginNew = await request.post("/auth/login").send({ phone, password: "newpassword123" });
    expect(loginNew.status).toBe(200);
  });

  it("returns 409 for invalid OTP", async () => {
    const phone = "+966500000043";
    await seedCustomer({ phone });
    await store.requestPasswordResetOtp(phone);

    const res = await request.post("/auth/reset-password").send({
      phone,
      otp: "000000",
      password: "newpassword123",
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("password_reset_otp_invalid");
  });

  it("returns 409 when no OTP was requested", async () => {
    const phone = "+966500000044";
    await seedCustomer({ phone });

    const res = await request.post("/auth/reset-password").send({
      phone,
      otp: "123456",
      password: "newpassword123",
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("password_reset_otp_missing");
  });

  it("returns 400 on validation error", async () => {
    const res = await request.post("/auth/reset-password").send({ phone: "123", otp: "abc", password: "x" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });
});

// ─── POST /orders ────────────────────────────────────────────────────────────

describe("POST /orders", () => {
  it("authenticated customer can create an order", async () => {
    const { token } = await seedCustomer({ phone: "+966500000050" });

    const res = await request
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send(ORDER_BODY);

    expect(res.status).toBe(201);
    expect(res.body.order).toBeDefined();
    expect(res.body.order.status).toBe("pending");
  });

  it("rider cannot create an order (403)", async () => {
    const { token } = await seedRider({ phone: "+966500000051" });

    const res = await request
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send(ORDER_BODY);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("customer_account_required");
  });

  it("unauthenticated request is blocked (401)", async () => {
    const res = await request.post("/orders").send(ORDER_BODY);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("missing_token");
  });

  it("returns 400 on validation error", async () => {
    const { token } = await seedCustomer({ phone: "+966500000052" });

    const res = await request
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ pickupAddress: "A" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });
});

// ─── POST /orders/:id/cancel ─────────────────────────────────────────────────

describe("POST /orders/:id/cancel", () => {
  it("customer can cancel their own pending order", async () => {
    const { token } = await seedCustomer({ phone: "+966500000060" });

    const createRes = await request
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send(ORDER_BODY);

    const orderId = createRes.body.order.id;

    const res = await request
      .post(`/orders/${orderId}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("canceled");
    expect(res.body.order.canceledAt).toBeDefined();
  });

  it("customer cannot cancel another customer's order (403)", async () => {
    const c1 = await seedCustomer({ phone: "+966500000061" });
    const c2 = await seedCustomer({ phone: "+966500000062" });

    const createRes = await request
      .post("/orders")
      .set("Authorization", `Bearer ${c1.token}`)
      .send(ORDER_BODY);

    const orderId = createRes.body.order.id;

    const res = await request
      .post(`/orders/${orderId}/cancel`)
      .set("Authorization", `Bearer ${c2.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("not_order_owner");
  });

  it("cannot cancel a non-existent order (404)", async () => {
    const { token } = await seedCustomer({ phone: "+966500000063" });

    const res = await request
      .post("/orders/00000000-0000-0000-0000-000000000000/cancel")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("order_not_found");
  });

  it("rider cannot call cancel endpoint (403 customer_account_required)", async () => {
    const customer = await seedCustomer({ phone: "+966500000064" });
    const { token: riderToken } = await seedRider({ phone: "+966500000065" });

    const createRes = await request
      .post("/orders")
      .set("Authorization", `Bearer ${customer.token}`)
      .send(ORDER_BODY);

    const orderId = createRes.body.order.id;

    const res = await request
      .post(`/orders/${orderId}/cancel`)
      .set("Authorization", `Bearer ${riderToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("customer_account_required");
  });

  it("cannot cancel a non-pending order (409)", async () => {
    const { token, user } = await seedCustomer({ phone: "+966500000066" });

    const createRes = await request
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send(ORDER_BODY);

    const orderId = createRes.body.order.id;

    // Force status to 'assigned' via admin
    await request
      .patch(`/orders/${orderId}/status`)
      .set("x-admin-key", "test-admin-key")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "delivered", courierId: null });

    const res = await request
      .post(`/orders/${orderId}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("order_not_cancelable");
  });
});

// ─── GET /orders ─────────────────────────────────────────────────────────────

describe("GET /orders", () => {
  it("customer sees only their own orders with pagination shape", async () => {
    const { token } = await seedCustomer({ phone: "+966500000070" });

    // Create 2 orders
    await request.post("/orders").set("Authorization", `Bearer ${token}`).send(ORDER_BODY);
    await request.post("/orders").set("Authorization", `Bearer ${token}`).send(ORDER_BODY);

    const res = await request
      .get("/orders")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body.orders.length).toBeGreaterThanOrEqual(2);
    expect(typeof res.body.total).toBe("number");
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });

  it("customer does not see other customers orders", async () => {
    const c1 = await seedCustomer({ phone: "+966500000071" });
    const c2 = await seedCustomer({ phone: "+966500000072" });

    await request.post("/orders").set("Authorization", `Bearer ${c1.token}`).send(ORDER_BODY);

    const res = await request
      .get("/orders")
      .set("Authorization", `Bearer ${c2.token}`);

    expect(res.status).toBe(200);
    // c2 has no orders of their own yet
    const c2OrderUserIds = res.body.orders.map((o) => o.userId);
    expect(c2OrderUserIds.every((id) => id === c2.user.id)).toBe(true);
  });

  it("admin sees all orders when ?admin=true", async () => {
    const { token } = await seedCustomer({ phone: "+966500000073" });

    const res = await request
      .get("/orders?admin=true")
      .set("Authorization", `Bearer ${token}`)
      .set("x-admin-key", "test-admin-key");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.orders)).toBe(true);
  });

  it("returns 403 when ?admin=true without admin key", async () => {
    const { token } = await seedCustomer({ phone: "+966500000074" });

    const res = await request
      .get("/orders?admin=true")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("admin_key_required");
  });

  it("rider sees their delivery history", async () => {
    const { token } = await seedRider({ phone: "+966500000075" });

    const res = await request
      .get("/orders")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.orders)).toBe(true);
  });

  it("respects page and limit query params", async () => {
    const { token } = await seedCustomer({ phone: "+966500000076" });

    // Create 3 orders
    for (let i = 0; i < 3; i++) {
      await request.post("/orders").set("Authorization", `Bearer ${token}`).send(ORDER_BODY);
    }

    const res = await request
      .get("/orders?page=1&limit=2")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBeLessThanOrEqual(2);
    expect(res.body.limit).toBe(2);
    expect(res.body.page).toBe(1);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await request.get("/orders");

    expect(res.status).toBe(401);
  });
});
