import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  apiRequest,
  clearSession,
  Courier,
  getToken,
  login,
  Order,
  OrderStatus,
} from "./api";

const statuses: OrderStatus[] = ["pending", "assigned", "delivered", "canceled"];

const statusLabels: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  assigned: "Rider Assigned",
  delivered: "Delivered",
  canceled: "Canceled",
};

function formatDistance(value?: number | null) {
  return value ? `${value.toFixed(1)} km` : "-";
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(Boolean(getToken()));
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "all">("all");
  const [error, setError] = useState("");

  const filteredOrders = useMemo(() => {
    if (selectedStatus === "all") return orders;
    return orders.filter((order) => order.status === selectedStatus);
  }, [orders, selectedStatus]);

  useEffect(() => {
    if (!authenticated) return undefined;

    void loadDashboard();
    const timer = setInterval(() => {
      void loadDashboard();
    }, 10000);

    return () => clearInterval(timer);
  }, [authenticated]);

  async function loadDashboard() {
    try {
      setError("");
      const [ordersPayload, couriersPayload] = await Promise.all([
        apiRequest<{ orders: Order[] }>("/orders?admin=true"),
        apiRequest<{ couriers: Courier[] }>("/couriers"),
      ]);
      setOrders(ordersPayload.orders);
      setCouriers(couriersPayload.couriers);
    } catch {
      setError("Could not load orders. Check your login details and admin key.");
    }
  }

  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    try {
      setError("");
      await login(phone, password, adminKey);
      setAuthenticated(true);
    } catch {
      setError("The login details are not correct.");
    }
  }

  async function updateStatus(order: Order, status: OrderStatus) {
    try {
      const firstCourier = couriers.find((courier) => !courier.activeOrderId) || couriers[0];
      const payload = await apiRequest<{ order: Order }>(`/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          courierId: status === "assigned" ? firstCourier?.id : order.courierId,
        }),
      });
      setOrders((current) => current.map((item) => (item.id === order.id ? payload.order : item)));
    } catch {
      setError("Could not update the order status.");
    }
  }

  function logout() {
    clearSession();
    setAuthenticated(false);
  }

  if (!authenticated) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <p className="brand-ar">واصل</p>
          <h1>Order admin</h1>
          <form onSubmit={submitLogin}>
            <label>
              Phone number
              <input value={phone} onChange={(event) => setPhone(event.target.value)} />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <label>
              Admin key
              <input value={adminKey} onChange={(event) => setAdminKey(event.target.value)} />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit">Log in</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <p className="brand-ar">واصل</p>
          <h1>Wasel orders</h1>
        </div>
        <div className="actions">
          <button className="ghost" onClick={loadDashboard}>
            Refresh
          </button>
          <button className="ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <section className="metrics">
        <article>
          <span>All orders</span>
          <strong>{orders.length}</strong>
        </article>
        <article>
          <span>Pending</span>
          <strong>{orders.filter((order) => order.status === "pending").length}</strong>
        </article>
        <article>
          <span>Assigned</span>
          <strong>{orders.filter((order) => order.status === "assigned").length}</strong>
        </article>
        <article>
          <span>Delivered</span>
          <strong>{orders.filter((order) => order.status === "delivered").length}</strong>
        </article>
      </section>

      <section className="filters" aria-label="Filter orders">
        <button className={selectedStatus === "all" ? "active" : ""} onClick={() => setSelectedStatus("all")}>
          All
        </button>
        {statuses.map((status) => (
          <button
            className={selectedStatus === status ? "active" : ""}
            key={status}
            onClick={() => setSelectedStatus(status)}
          >
            {statusLabels[status]}
          </button>
        ))}
      </section>

      {error && <p className="error">{error}</p>}

      <section className="orders">
        {filteredOrders.map((order) => (
          <article className="order-card" key={order.id}>
            <div className="order-head">
              <div>
                <span className="status">{statusLabels[order.status]}</span>
                <h2>{order.itemDescription}</h2>
              </div>
              <strong>{order.price} SAR</strong>
            </div>
            <dl>
              <div>
                <dt>Customer</dt>
                <dd>{order.user ? `${order.user.name} · ${order.user.phone}` : order.userId}</dd>
              </div>
              <div>
                <dt>Pickup</dt>
                <dd>{order.pickupAddress}</dd>
              </div>
              <div>
                <dt>Drop-off</dt>
                <dd>{order.dropoffAddress}</dd>
              </div>
              <div>
                <dt>Recipient</dt>
                <dd>{[order.recipientName, order.recipientPhone].filter(Boolean).join(" · ") || "Not provided"}</dd>
              </div>
              <div>
                <dt>Items</dt>
                <dd>{order.itemCount || 1}</dd>
              </div>
              <div>
                <dt>Trip distance</dt>
                <dd>{formatDistance(order.distanceKm)}</dd>
              </div>
              <div>
                <dt>Nearby riders</dt>
                <dd>
                  {order.matchedRiderCount} matched · {order.pendingRiderCount} pending
                </dd>
              </div>
              <div>
                <dt>Rider</dt>
                <dd>{order.courier ? `${order.courier.name} · ${order.courier.phone}` : "Waiting for acceptance"}</dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>{order.paymentMethod}</dd>
              </div>
            </dl>
            <div className="status-actions">
              {statuses.map((status) => (
                <button key={status} onClick={() => updateStatus(order, status)}>
                  {statusLabels[status]}
                </button>
              ))}
            </div>
          </article>
        ))}
        {!filteredOrders.length && <p className="empty">No orders in this status.</p>}
      </section>
    </main>
  );
}
