import crypto from "crypto";
import pg from "pg";

const { Pool } = pg;

const orderFields = `
  id,
  user_id as "userId",
  pickup_address as "pickupAddress",
  dropoff_address as "dropoffAddress",
  recipient_name as "recipientName",
  recipient_phone as "recipientPhone",
  item_count as "itemCount",
  pickup_lat as "pickupLat",
  pickup_lng as "pickupLng",
  dropoff_lat as "dropoffLat",
  dropoff_lng as "dropoffLng",
  item_description as "itemDescription",
  package_type as "packageType",
  urgency,
  payment_method as "paymentMethod",
  distance_km as "distanceKm",
  price,
  status,
  courier_id as "courierId",
  delivered_at as "deliveredAt",
  canceled_at as "canceledAt",
  estimated_delivery_minutes as "estimatedDeliveryMinutes",
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

const orderSelectFields = `
  o.id,
  o.user_id as "userId",
  o.pickup_address as "pickupAddress",
  o.dropoff_address as "dropoffAddress",
  o.recipient_name as "recipientName",
  o.recipient_phone as "recipientPhone",
  o.item_count as "itemCount",
  o.pickup_lat as "pickupLat",
  o.pickup_lng as "pickupLng",
  o.dropoff_lat as "dropoffLat",
  o.dropoff_lng as "dropoffLng",
  o.item_description as "itemDescription",
  o.package_type as "packageType",
  o.urgency,
  o.payment_method as "paymentMethod",
  o.distance_km as "distanceKm",
  o.price,
  o.status,
  o.courier_id as "courierId",
  o.delivered_at as "deliveredAt",
  o.canceled_at as "canceledAt",
  o.estimated_delivery_minutes as "estimatedDeliveryMinutes",
  o.created_at as "createdAt",
  o.updated_at as "updatedAt",
  c.name as "courierName",
  c.phone as "courierPhone",
  c.current_lat as "courierCurrentLat",
  c.current_lng as "courierCurrentLng",
  c.is_available as "courierIsAvailable",
  c.active_order_id as "courierActiveOrderId",
  u.name as "userName",
  u.phone as "userPhone",
  coalesce((
    select count(*)
    from order_matches om
    where om.order_id = o.id
  ), 0)::int as "matchedRiderCount",
  coalesce((
    select count(*)
    from order_matches om
    where om.order_id = o.id and om.state = 'pending'
  ), 0)::int as "pendingRiderCount"
`;

function asNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    role: "customer",
    name: user.name,
    phone: user.phone,
    pushToken: user.pushToken ?? user.push_token ?? null,
    createdAt: user.createdAt ?? user.created_at,
  };
}

function publicCourier(courier) {
  if (!courier) return null;
  return {
    id: courier.id,
    role: "rider",
    name: courier.name,
    phone: courier.phone,
    isAvailable: Boolean(courier.isAvailable ?? courier.is_available),
    currentLat: asNumber(courier.currentLat ?? courier.current_lat),
    currentLng: asNumber(courier.currentLng ?? courier.current_lng),
    activeOrderId: courier.activeOrderId ?? courier.active_order_id ?? null,
    createdAt: courier.createdAt ?? courier.created_at,
  };
}

function publicOrder(order) {
  if (!order) return null;

  const courier =
    order.courier ||
    (order.courierId && order.courierName
      ? {
          id: order.courierId,
          name: order.courierName,
          phone: order.courierPhone,
          currentLat: asNumber(order.courierCurrentLat),
          currentLng: asNumber(order.courierCurrentLng),
          isAvailable: Boolean(order.courierIsAvailable),
          activeOrderId: order.courierActiveOrderId ?? null,
        }
      : null);
  const user =
    order.user || (order.userName && order.userPhone ? { id: order.userId, name: order.userName, phone: order.userPhone } : null);

  return {
    id: order.id,
    userId: order.userId,
    user: user ? { id: user.id, name: user.name, phone: user.phone } : null,
    pickupAddress: order.pickupAddress,
    dropoffAddress: order.dropoffAddress,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    itemCount: Number(order.itemCount ?? 1),
    pickupLat: asNumber(order.pickupLat),
    pickupLng: asNumber(order.pickupLng),
    dropoffLat: asNumber(order.dropoffLat),
    dropoffLng: asNumber(order.dropoffLng),
    itemDescription: order.itemDescription,
    packageType: order.packageType,
    urgency: order.urgency,
    paymentMethod: order.paymentMethod,
    distanceKm: asNumber(order.distanceKm) ?? 0,
    price: Number(order.price),
    status: order.status,
    courierId: order.courierId,
    courier: courier
      ? {
          id: courier.id,
          name: courier.name,
          phone: courier.phone,
          currentLat: asNumber(courier.currentLat),
          currentLng: asNumber(courier.currentLng),
          isAvailable: Boolean(courier.isAvailable),
          activeOrderId: courier.activeOrderId ?? null,
        }
      : null,
    estimatedDeliveryMinutes: Number(order.estimatedDeliveryMinutes),
    deliveredAt: order.deliveredAt ?? null,
    canceledAt: order.canceledAt ?? null,
    matchedRiderCount: Number(order.matchedRiderCount ?? 0),
    pendingRiderCount: Number(order.pendingRiderCount ?? 0),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function publicRiderRequest(match) {
  return {
    id: match.id,
    pickupAddress: match.pickupAddress,
    dropoffAddress: match.dropoffAddress,
    recipientName: match.recipientName,
    recipientPhone: match.recipientPhone,
    itemCount: Number(match.itemCount ?? 1),
    itemDescription: match.itemDescription,
    packageType: match.packageType,
    urgency: match.urgency,
    price: Number(match.price),
    distanceKm: asNumber(match.distanceKm) ?? 0,
    distanceToPickupKm: asNumber(match.distanceToPickupKm) ?? 0,
    estimatedDeliveryMinutes: Number(match.estimatedDeliveryMinutes),
    createdAt: match.createdAt,
  };
}

function storeError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

const DELIVERY_OTP_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_OTP_TTL_MS = 10 * 60 * 1000;

function hashOtp(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function createDeliveryOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function createPasswordResetOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

export function createStore(databaseUrl) {
  if (databaseUrl) {
    return createPostgresStore(databaseUrl);
  }

  return createMemoryStore();
}

function createMemoryStore() {
  const users = [];
  const couriers = [];
  const orders = [];
  const orderMatches = [];

  const getAssignedOrderForCourier = (courierId) =>
    orders.find((order) => order.courierId === courierId && order.status === "assigned") || null;

  const withOrderMeta = (order) => ({
    ...order,
    matchedRiderCount: orderMatches.filter((match) => match.orderId === order.id).length,
    pendingRiderCount: orderMatches.filter((match) => match.orderId === order.id && match.state === "pending").length,
    courier: couriers.find((item) => item.id === order.courierId) || null,
    user: users.find((item) => item.id === order.userId) || null,
  });

  const getOrderRecord = (id) => orders.find((order) => order.id === id) || null;
  const getCourierRecord = (id) => couriers.find((courier) => courier.id === id) || null;
  const nowIso = () => new Date().toISOString();

  return {
    mode: "memory",
    async createUser({ name, phone, passwordHash }) {
      const user = {
        id: crypto.randomUUID(),
        name,
        phone,
        passwordHash,
        pushToken: null,
        passwordResetOtpHash: null,
        passwordResetOtpExpiresAt: null,
        passwordResetOtpSentAt: null,
        createdAt: nowIso(),
      };
      users.push(user);
      return publicUser(user);
    },
    async createCourier({ name, phone, passwordHash, currentLat = null, currentLng = null, isAvailable = true }) {
      const existing = couriers.find((courier) => courier.phone === phone);
      if (existing) {
        Object.assign(existing, { name, passwordHash, currentLat, currentLng, isAvailable, activeOrderId: null });
        return publicCourier(existing);
      }

      const courier = {
        id: crypto.randomUUID(),
        name,
        phone,
        passwordHash,
        currentLat,
        currentLng,
        isAvailable,
        activeOrderId: null,
        createdAt: nowIso(),
      };
      couriers.push(courier);
      return publicCourier(courier);
    },
    async findUserByPhone(phone) {
      return users.find((user) => user.phone === phone) || null;
    },
    async requestPasswordResetOtp(phone) {
      const user = users.find((item) => item.phone === phone);
      if (!user) return null;

      const code = createPasswordResetOtp();
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MS).toISOString();
      user.passwordResetOtpHash = hashOtp(code);
      user.passwordResetOtpExpiresAt = expiresAt;
      user.passwordResetOtpSentAt = nowIso();

      return {
        recipientPhone: user.phone,
        expiresAt,
        code,
      };
    },
    async resetPasswordWithOtp(phone, otp, passwordHash) {
      const user = users.find((item) => item.phone === phone);
      if (!user) throw storeError("user_not_found");
      if (!user.passwordResetOtpHash || !user.passwordResetOtpExpiresAt) throw storeError("password_reset_otp_missing");
      if (new Date(user.passwordResetOtpExpiresAt).getTime() < Date.now()) throw storeError("password_reset_otp_expired");
      if (!otp || hashOtp(otp) !== user.passwordResetOtpHash) throw storeError("password_reset_otp_invalid");

      user.passwordHash = passwordHash;
      user.passwordResetOtpHash = null;
      user.passwordResetOtpExpiresAt = null;
      user.passwordResetOtpSentAt = null;

      return publicUser(user);
    },
    async findCourierByPhone(phone) {
      return couriers.find((courier) => courier.phone === phone) || null;
    },
    async getUserById(id) {
      return publicUser(users.find((user) => user.id === id));
    },
    async getCourierById(id) {
      const courier = couriers.find((item) => item.id === id);
      if (!courier) return null;
      const activeOrder = getAssignedOrderForCourier(courier.id);
      return publicCourier({ ...courier, activeOrderId: activeOrder?.id ?? null });
    },
    async savePushToken(userId, pushToken) {
      const user = users.find((item) => item.id === userId);
      if (!user) return null;
      user.pushToken = pushToken;
      return publicUser(user);
    },
    async createOrder(input) {
      const order = {
        id: crypto.randomUUID(),
        status: "pending",
        courierId: null,
        deliveredAt: null,
        canceledAt: null,
        deliveryOtpHash: null,
        deliveryOtpExpiresAt: null,
        deliveryOtpSentAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        ...input,
      };
      orders.unshift(order);
      return publicOrder(withOrderMeta(order));
    },
    async listOrders({ userId, includeAll = false, page = 1, limit = 20 } = {}) {
      const all = includeAll ? orders : orders.filter((order) => order.userId === userId);
      const total = all.length;
      const offset = (page - 1) * limit;
      const result = all.slice(offset, offset + limit);
      return { orders: result.map((order) => publicOrder(withOrderMeta(order))), total, page, limit };
    },
    async getOrderById(id) {
      const order = getOrderRecord(id);
      return order ? publicOrder(withOrderMeta(order)) : null;
    },
    async updateOrder(id, patch) {
      const order = getOrderRecord(id);
      if (!order) return null;
      Object.assign(order, patch, { updatedAt: nowIso() });
      return publicOrder(withOrderMeta(order));
    },
    async listCouriers({ onlyAvailable = false } = {}) {
      const result = onlyAvailable ? couriers.filter((courier) => courier.isAvailable) : couriers;
      return result.map((courier) => {
        const activeOrder = getAssignedOrderForCourier(courier.id);
        return publicCourier({ ...courier, activeOrderId: activeOrder?.id ?? null });
      });
    },
    async updateCourier(id, patch) {
      const courier = getCourierRecord(id);
      if (!courier) return null;
      Object.assign(courier, patch);
      return publicCourier(courier);
    },
    async listPendingOrders() {
      return orders.filter((order) => order.status === "pending" && !order.courierId).map((order) => publicOrder(withOrderMeta(order)));
    },
    async upsertOrderMatches(orderId, matches) {
      for (const match of matches) {
        const existing = orderMatches.find((item) => item.orderId === orderId && item.courierId === match.courierId);
        if (existing) {
          if (existing.state === "accepted" || existing.state === "rejected") continue;
          existing.distanceToPickupKm = match.distanceToPickupKm;
          existing.state = "pending";
          existing.updatedAt = nowIso();
          continue;
        }

        orderMatches.push({
          id: crypto.randomUUID(),
          orderId,
          courierId: match.courierId,
          distanceToPickupKm: match.distanceToPickupKm,
          state: "pending",
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
      }
    },
    async listAvailableRequestsForCourier(courierId) {
      const courier = getCourierRecord(courierId);
      if (!courier || !courier.isAvailable || getAssignedOrderForCourier(courierId)) return [];

      return orderMatches
        .filter((match) => match.courierId === courierId && match.state === "pending")
        .map((match) => {
          const order = getOrderRecord(match.orderId);
          if (!order || order.status !== "pending" || order.courierId) return null;
          return publicRiderRequest({
            ...order,
            distanceToPickupKm: match.distanceToPickupKm,
          });
        })
        .filter(Boolean)
        .sort((left, right) => left.distanceToPickupKm - right.distanceToPickupKm);
    },
    async rejectOrderForCourier(orderId, courierId) {
      const match = orderMatches.find((item) => item.orderId === orderId && item.courierId === courierId);
      const order = getOrderRecord(orderId);
      if (!match || !order || order.status !== "pending" || order.courierId) {
        throw storeError("request_not_available");
      }
      match.state = "rejected";
      match.updatedAt = nowIso();
      return true;
    },
    async acceptOrder(orderId, courierId) {
      const courier = getCourierRecord(courierId);
      if (!courier) throw storeError("rider_not_found");
      if (!courier.isAvailable) throw storeError("rider_unavailable");
      if (getAssignedOrderForCourier(courierId)) throw storeError("rider_has_active_order");

      const order = getOrderRecord(orderId);
      if (!order) throw storeError("order_not_found");
      if (order.status === "delivered") throw storeError("order_already_delivered");
      if (order.courierId && order.courierId !== courierId) throw storeError("request_already_assigned");
      if (order.status !== "pending" || order.courierId) throw storeError("request_not_available");

      const match = orderMatches.find((item) => item.orderId === orderId && item.courierId === courierId);
      if (!match || match.state !== "pending") throw storeError("request_not_available");

      order.status = "assigned";
      order.courierId = courierId;
      order.updatedAt = nowIso();
      courier.activeOrderId = orderId;

      for (const currentMatch of orderMatches.filter((item) => item.orderId === orderId)) {
        currentMatch.state = currentMatch.courierId === courierId ? "accepted" : "expired";
        currentMatch.updatedAt = nowIso();
      }

      return publicOrder(withOrderMeta(order));
    },
    async getCurrentDeliveryForCourier(courierId) {
      const order = orders.find((item) => item.courierId === courierId && item.status === "assigned");
      return order ? publicOrder(withOrderMeta(order)) : null;
    },
    async markOrderDelivered(orderId, courierId) {
      return this.markOrderDeliveredWithOtp(orderId, courierId, null);
    },
    async requestDeliveryOtp(orderId, courierId) {
      const order = getOrderRecord(orderId);
      if (!order) throw storeError("order_not_found");
      if (order.status === "delivered") throw storeError("order_already_delivered");
      if (order.status !== "assigned" || order.courierId !== courierId) throw storeError("not_assigned_to_rider");

      const code = createDeliveryOtp();
      const expiresAt = new Date(Date.now() + DELIVERY_OTP_TTL_MS).toISOString();
      order.deliveryOtpHash = hashOtp(code);
      order.deliveryOtpExpiresAt = expiresAt;
      order.deliveryOtpSentAt = nowIso();
      order.updatedAt = nowIso();

      return {
        recipientPhone: order.recipientPhone,
        expiresAt,
        code,
      };
    },
    async markOrderDeliveredWithOtp(orderId, courierId, otp) {
      const order = getOrderRecord(orderId);
      if (!order) throw storeError("order_not_found");
      if (order.status === "delivered") throw storeError("order_already_delivered");
      if (order.status !== "assigned" || order.courierId !== courierId) throw storeError("not_assigned_to_rider");
      if (!order.deliveryOtpHash || !order.deliveryOtpExpiresAt) throw storeError("delivery_otp_missing");
      if (new Date(order.deliveryOtpExpiresAt).getTime() < Date.now()) throw storeError("delivery_otp_expired");
      if (!otp || hashOtp(otp) !== order.deliveryOtpHash) throw storeError("delivery_otp_invalid");

      const courier = getCourierRecord(courierId);
      if (!courier) throw storeError("rider_not_found");

      order.status = "delivered";
      order.deliveredAt = nowIso();
      order.deliveryOtpHash = null;
      order.deliveryOtpExpiresAt = null;
      order.deliveryOtpSentAt = null;
      order.updatedAt = nowIso();
      courier.activeOrderId = null;

      return publicOrder(withOrderMeta(order));
    },
    async listCourierHistory(courierId) {
      return orders
        .filter((order) => order.courierId === courierId)
        .map((order) => publicOrder(withOrderMeta(order)));
    },
    async cancelOrder(orderId, userId) {
      const order = getOrderRecord(orderId);
      if (!order) throw storeError("order_not_found");
      if (order.userId !== userId) throw storeError("not_order_owner");
      if (order.status !== "pending") throw storeError("order_not_cancelable");

      order.status = "canceled";
      order.canceledAt = nowIso();
      order.updatedAt = nowIso();
      return publicOrder(withOrderMeta(order));
    },
  };
}

function createPostgresStore(databaseUrl) {
  const pool = new Pool({ connectionString: databaseUrl });
  const courierSelect = `
    c.id,
    c.name,
    c.phone,
    c.is_available as "isAvailable",
    c.current_lat as "currentLat",
    c.current_lng as "currentLng",
    case when ao.status = 'assigned' then c.active_order_id else null end as "activeOrderId",
    c.created_at
  `;

  return {
    mode: "postgres",
    async createUser({ name, phone, passwordHash }) {
      const result = await pool.query(
        `insert into users (name, phone, password_hash)
         values ($1, $2, $3)
         returning id, name, phone, push_token, created_at`,
        [name, phone, passwordHash],
      );
      return publicUser(result.rows[0]);
    },
    async createCourier({ name, phone, passwordHash, currentLat = null, currentLng = null, isAvailable = true }) {
      const result = await pool.query(
        `insert into couriers (name, phone, password_hash, is_available, current_lat, current_lng)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (phone)
         do update set
           name = excluded.name,
           password_hash = excluded.password_hash,
           is_available = excluded.is_available,
           current_lat = excluded.current_lat,
           current_lng = excluded.current_lng,
           active_order_id = null
         returning id, name, phone, is_available as "isAvailable", current_lat as "currentLat", current_lng as "currentLng", active_order_id as "activeOrderId", created_at`,
        [name, phone, passwordHash, isAvailable, currentLat, currentLng],
      );
      return publicCourier(result.rows[0]);
    },
    async findUserByPhone(phone) {
      const result = await pool.query(
        `select id, name, phone, password_hash as "passwordHash", push_token,
                password_reset_otp_hash as "passwordResetOtpHash",
                password_reset_otp_expires_at as "passwordResetOtpExpiresAt",
                password_reset_otp_sent_at as "passwordResetOtpSentAt",
                created_at
         from users
         where phone = $1`,
        [phone],
      );
      return result.rows[0] || null;
    },
    async requestPasswordResetOtp(phone) {
      const client = await pool.connect();

      try {
        await client.query("begin");

        const userResult = await client.query(
          `select id, phone
           from users
           where phone = $1
           for update`,
          [phone],
        );
        const user = userResult.rows[0];
        if (!user) {
          await client.query("commit");
          return null;
        }

        const code = createPasswordResetOtp();
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MS).toISOString();

        await client.query(
          `update users
           set password_reset_otp_hash = $2,
               password_reset_otp_expires_at = $3,
               password_reset_otp_sent_at = now()
           where id = $1`,
          [user.id, hashOtp(code), expiresAt],
        );

        await client.query("commit");
        return {
          recipientPhone: user.phone,
          expiresAt,
          code,
        };
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async resetPasswordWithOtp(phone, otp, passwordHash) {
      const client = await pool.connect();

      try {
        await client.query("begin");

        const userResult = await client.query(
          `select id,
                  password_reset_otp_hash as "passwordResetOtpHash",
                  password_reset_otp_expires_at as "passwordResetOtpExpiresAt"
           from users
           where phone = $1
           for update`,
          [phone],
        );
        const user = userResult.rows[0];
        if (!user) throw storeError("user_not_found");
        if (!user.passwordResetOtpHash || !user.passwordResetOtpExpiresAt) throw storeError("password_reset_otp_missing");
        if (new Date(user.passwordResetOtpExpiresAt).getTime() < Date.now()) throw storeError("password_reset_otp_expired");
        if (!otp || hashOtp(otp) !== user.passwordResetOtpHash) throw storeError("password_reset_otp_invalid");

        await client.query(
          `update users
           set password_hash = $2,
               password_reset_otp_hash = null,
               password_reset_otp_expires_at = null,
               password_reset_otp_sent_at = null
           where id = $1`,
          [user.id, passwordHash],
        );

        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }

      return this.findUserByPhone(phone);
    },
    async findCourierByPhone(phone) {
      const result = await pool.query(
        `select c.id, c.name, c.phone, c.password_hash as "passwordHash", c.is_available as "isAvailable", c.current_lat as "currentLat", c.current_lng as "currentLng",
                case when ao.status = 'assigned' then c.active_order_id else null end as "activeOrderId",
                c.created_at
         from couriers c
         left join orders ao on ao.id = c.active_order_id
         where phone = $1`,
        [phone],
      );
      return result.rows[0] || null;
    },
    async getUserById(id) {
      const result = await pool.query(
        `select id, name, phone, push_token, created_at
         from users
         where id = $1`,
        [id],
      );
      return publicUser(result.rows[0]);
    },
    async getCourierById(id) {
      const result = await pool.query(
        `select ${courierSelect}
         from couriers c
         left join orders ao on ao.id = c.active_order_id
         where c.id = $1`,
        [id],
      );
      return publicCourier(result.rows[0]);
    },
    async savePushToken(userId, pushToken) {
      const result = await pool.query(
        `update users
         set push_token = $2
         where id = $1
         returning id, name, phone, push_token, created_at`,
        [userId, pushToken],
      );
      return publicUser(result.rows[0]);
    },
    async createOrder(input) {
      const result = await pool.query(
        `insert into orders (
          user_id,
          pickup_address,
          dropoff_address,
          recipient_name,
          recipient_phone,
          item_count,
          pickup_lat,
          pickup_lng,
          dropoff_lat,
          dropoff_lng,
          item_description,
          package_type,
          urgency,
          payment_method,
          distance_km,
          price,
          estimated_delivery_minutes
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        returning ${orderFields}`,
        [
          input.userId,
          input.pickupAddress,
          input.dropoffAddress,
          input.recipientName,
          input.recipientPhone,
          input.itemCount,
          input.pickupLat,
          input.pickupLng,
          input.dropoffLat,
          input.dropoffLng,
          input.itemDescription,
          input.packageType,
          input.urgency,
          input.paymentMethod,
          input.distanceKm,
          input.price,
          input.estimatedDeliveryMinutes,
        ],
      );
      return publicOrder(result.rows[0]);
    },
    async listOrders({ userId, includeAll = false, page = 1, limit = 20 } = {}) {
      const offset = (page - 1) * limit;

      const countResult = includeAll
        ? await pool.query(`select count(*) from orders`)
        : await pool.query(`select count(*) from orders where user_id = $1`, [userId]);
      const total = Number(countResult.rows[0].count);

      const result = includeAll
        ? await pool.query(
            `select ${orderSelectFields}
             from orders o
             left join couriers c on c.id = o.courier_id
             left join users u on u.id = o.user_id
             order by o.created_at desc
             limit $1 offset $2`,
            [limit, offset],
          )
        : await pool.query(
            `select ${orderSelectFields}
             from orders o
             left join couriers c on c.id = o.courier_id
             left join users u on u.id = o.user_id
             where o.user_id = $1
             order by o.created_at desc
             limit $2 offset $3`,
            [userId, limit, offset],
          );

      return { orders: result.rows.map((order) => publicOrder(order)), total, page, limit };
    },
    async getOrderById(id) {
      const result = await pool.query(
        `select ${orderSelectFields}
         from orders o
         left join couriers c on c.id = o.courier_id
         left join users u on u.id = o.user_id
         where o.id = $1`,
        [id],
      );
      return publicOrder(result.rows[0]);
    },
    async updateOrder(id, patch) {
      const allowed = {
        status: "status",
        courierId: "courier_id",
        paymentMethod: "payment_method",
        deliveredAt: "delivered_at",
        canceledAt: "canceled_at",
      };
      const entries = Object.entries(patch).filter(([key]) => allowed[key]);
      if (!entries.length) return this.getOrderById(id);

      const assignments = entries.map(([key], index) => `${allowed[key]} = $${index + 2}`);
      const values = entries.map(([, value]) => value);
      const result = await pool.query(
        `update orders
         set ${assignments.join(", ")}, updated_at = now()
         where id = $1
         returning id`,
        [id, ...values],
      );
      return result.rows[0] ? this.getOrderById(id) : null;
    },
    async listCouriers({ onlyAvailable = false } = {}) {
      const result = onlyAvailable
        ? await pool.query(
            `select ${courierSelect}
             from couriers c
             left join orders ao on ao.id = c.active_order_id
             where c.is_available = true
             order by c.name asc`,
          )
        : await pool.query(
            `select ${courierSelect}
             from couriers c
             left join orders ao on ao.id = c.active_order_id
             order by c.name asc`,
          );
      return result.rows.map((courier) => publicCourier(courier));
    },
    async updateCourier(id, patch) {
      const allowed = {
        isAvailable: "is_available",
        currentLat: "current_lat",
        currentLng: "current_lng",
        activeOrderId: "active_order_id",
      };
      const entries = Object.entries(patch).filter(([key]) => allowed[key]);
      if (!entries.length) return this.getCourierById(id);

      const assignments = entries.map(([key], index) => `${allowed[key]} = $${index + 2}`);
      const values = entries.map(([, value]) => value);
      const result = await pool.query(
        `update couriers
         set ${assignments.join(", ")}
         where id = $1
         returning id`,
        [id, ...values],
      );
      return result.rows[0] ? this.getCourierById(id) : null;
    },
    async listPendingOrders() {
      const result = await pool.query(
        `select ${orderSelectFields}
         from orders o
         left join couriers c on c.id = o.courier_id
         left join users u on u.id = o.user_id
         where o.status = 'pending' and o.courier_id is null
         order by o.created_at desc`,
      );
      return result.rows.map((order) => publicOrder(order));
    },
    async upsertOrderMatches(orderId, matches) {
      for (const match of matches) {
        await pool.query(
          `insert into order_matches (order_id, courier_id, distance_to_pickup_km, state)
           values ($1, $2, $3, 'pending')
           on conflict (order_id, courier_id)
           do update set
             distance_to_pickup_km = excluded.distance_to_pickup_km,
             state = case
               when order_matches.state = 'expired' then 'pending'
               else order_matches.state
             end,
             updated_at = now()`,
          [orderId, match.courierId, match.distanceToPickupKm],
        );
      }
    },
    async listAvailableRequestsForCourier(courierId) {
      const courier = await this.getCourierById(courierId);
      if (!courier || !courier.isAvailable || courier.activeOrderId) return [];

      const result = await pool.query(
        `select
           o.id,
           o.pickup_address as "pickupAddress",
           o.dropoff_address as "dropoffAddress",
           o.recipient_name as "recipientName",
           o.recipient_phone as "recipientPhone",
           o.item_count as "itemCount",
           o.item_description as "itemDescription",
           o.package_type as "packageType",
           o.urgency,
           o.price,
           o.distance_km as "distanceKm",
           o.estimated_delivery_minutes as "estimatedDeliveryMinutes",
           o.created_at as "createdAt",
           om.distance_to_pickup_km as "distanceToPickupKm"
         from order_matches om
         join orders o on o.id = om.order_id
         where om.courier_id = $1
           and om.state = 'pending'
           and o.status = 'pending'
           and o.courier_id is null
         order by om.distance_to_pickup_km asc, o.created_at desc`,
        [courierId],
      );
      return result.rows.map((row) => publicRiderRequest(row));
    },
    async rejectOrderForCourier(orderId, courierId) {
      const result = await pool.query(
        `update order_matches om
         set state = 'rejected', updated_at = now()
         from orders o
         where om.order_id = $1
           and om.courier_id = $2
           and om.state = 'pending'
           and o.id = om.order_id
           and o.status = 'pending'
           and o.courier_id is null
         returning om.id`,
        [orderId, courierId],
      );

      if (!result.rows[0]) {
        throw storeError("request_not_available");
      }

      return true;
    },
    async acceptOrder(orderId, courierId) {
      const client = await pool.connect();

      try {
        await client.query("begin");

        const courierResult = await client.query(
          `select c.id, c.is_available as "isAvailable", c.active_order_id as "activeOrderId"
           from couriers c
           where c.id = $1
           for update`,
          [courierId],
        );
        const courier = courierResult.rows[0];
        if (!courier) throw storeError("rider_not_found");
        if (!courier.isAvailable) throw storeError("rider_unavailable");
        if (courier.activeOrderId) {
          const activeOrderResult = await client.query(
            `select status
             from orders
             where id = $1`,
            [courier.activeOrderId],
          );
          if (activeOrderResult.rows[0]?.status === "assigned") {
            throw storeError("rider_has_active_order");
          }
        }

        const orderResult = await client.query(
          `select id, status, courier_id as "courierId"
           from orders
           where id = $1
           for update`,
          [orderId],
        );
        const order = orderResult.rows[0];
        if (!order) throw storeError("order_not_found");
        if (order.status === "delivered") throw storeError("order_already_delivered");
        if (order.courierId && order.courierId !== courierId) throw storeError("request_already_assigned");
        if (order.status !== "pending" || order.courierId) throw storeError("request_not_available");

        const matchResult = await client.query(
          `select id
           from order_matches
           where order_id = $1 and courier_id = $2 and state = 'pending'
           for update`,
          [orderId, courierId],
        );
        if (!matchResult.rows[0]) throw storeError("request_not_available");

        await client.query(
          `update orders
           set status = 'assigned', courier_id = $2, updated_at = now()
           where id = $1`,
          [orderId, courierId],
        );

        await client.query(
          `update couriers
           set active_order_id = $2
           where id = $1`,
          [courierId, orderId],
        );

        await client.query(
          `update order_matches
           set state = case when courier_id = $2 then 'accepted' else 'expired' end,
               updated_at = now()
           where order_id = $1 and state = 'pending'`,
          [orderId, courierId],
        );

        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }

      return this.getOrderById(orderId);
    },
    async getCurrentDeliveryForCourier(courierId) {
      const result = await pool.query(
        `select ${orderSelectFields}
         from orders o
         left join couriers c on c.id = o.courier_id
         left join users u on u.id = o.user_id
         where o.courier_id = $1 and o.status = 'assigned'
         order by o.updated_at desc
         limit 1`,
        [courierId],
      );
      return publicOrder(result.rows[0]);
    },
    async requestDeliveryOtp(orderId, courierId) {
      const client = await pool.connect();

      try {
        await client.query("begin");

        const orderResult = await client.query(
          `select id, status, courier_id as "courierId", recipient_phone as "recipientPhone"
           from orders
           where id = $1
           for update`,
          [orderId],
        );
        const order = orderResult.rows[0];
        if (!order) throw storeError("order_not_found");
        if (order.status === "delivered") throw storeError("order_already_delivered");
        if (order.status !== "assigned" || order.courierId !== courierId) throw storeError("not_assigned_to_rider");

        const code = createDeliveryOtp();
        const expiresAt = new Date(Date.now() + DELIVERY_OTP_TTL_MS).toISOString();

        await client.query(
          `update orders
           set delivery_otp_hash = $2,
               delivery_otp_expires_at = $3,
               delivery_otp_sent_at = now(),
               updated_at = now()
           where id = $1`,
          [orderId, hashOtp(code), expiresAt],
        );

        await client.query("commit");
        return {
          recipientPhone: order.recipientPhone,
          expiresAt,
          code,
        };
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async markOrderDelivered(orderId, courierId) {
      return this.markOrderDeliveredWithOtp(orderId, courierId, null);
    },
    async markOrderDeliveredWithOtp(orderId, courierId, otp) {
      const client = await pool.connect();

      try {
        await client.query("begin");

        const orderResult = await client.query(
          `select id, status, courier_id as "courierId",
                  delivery_otp_hash as "deliveryOtpHash",
                  delivery_otp_expires_at as "deliveryOtpExpiresAt"
           from orders
           where id = $1
           for update`,
          [orderId],
        );
        const order = orderResult.rows[0];
        if (!order) throw storeError("order_not_found");
        if (order.status === "delivered") throw storeError("order_already_delivered");
        if (order.status !== "assigned" || order.courierId !== courierId) throw storeError("not_assigned_to_rider");
        if (!order.deliveryOtpHash || !order.deliveryOtpExpiresAt) throw storeError("delivery_otp_missing");
        if (new Date(order.deliveryOtpExpiresAt).getTime() < Date.now()) throw storeError("delivery_otp_expired");
        if (!otp || hashOtp(otp) !== order.deliveryOtpHash) throw storeError("delivery_otp_invalid");

        await client.query(
          `update orders
           set status = 'delivered',
               delivered_at = now(),
               delivery_otp_hash = null,
               delivery_otp_expires_at = null,
               delivery_otp_sent_at = null,
               updated_at = now()
           where id = $1`,
          [orderId],
        );

        await client.query(
          `update couriers
           set active_order_id = null
           where id = $1`,
          [courierId],
        );

        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }

      return this.getOrderById(orderId);
    },
    async listCourierHistory(courierId) {
      const result = await pool.query(
        `select ${orderSelectFields}
         from orders o
         left join couriers c on c.id = o.courier_id
         left join users u on u.id = o.user_id
         where o.courier_id = $1
         order by o.updated_at desc`,
        [courierId],
      );
      return result.rows.map((order) => publicOrder(order));
    },
    async cancelOrder(orderId, userId) {
      const client = await pool.connect();
      try {
        await client.query("begin");

        const orderResult = await client.query(
          `select id, status, user_id as "userId"
           from orders
           where id = $1
           for update`,
          [orderId],
        );
        const order = orderResult.rows[0];
        if (!order) throw storeError("order_not_found");
        if (order.userId !== userId) throw storeError("not_order_owner");
        if (order.status !== "pending") throw storeError("order_not_cancelable");

        await client.query(
          `update orders
           set status = 'canceled',
               canceled_at = now(),
               updated_at = now()
           where id = $1`,
          [orderId],
        );

        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }

      return this.getOrderById(orderId);
    },
  };
}
