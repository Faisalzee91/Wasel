import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { createStore } from "./store.js";

function requiredDatabaseUrl() {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required to run the seed script.");
  }

  return config.databaseUrl;
}

async function ensureUser(store, { name, phone, password }) {
  const existing = await store.findUserByPhone(phone);
  if (existing) {
    return { created: false, role: "customer", phone };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await store.createUser({ name, phone, passwordHash });
  return { created: true, role: "customer", phone };
}

async function ensureRider(store, { name, phone, password, currentLat, currentLng, isAvailable }) {
  const passwordHash = await bcrypt.hash(password, 10);
  await store.createCourier({
    name,
    phone,
    passwordHash,
    currentLat,
    currentLng,
    isAvailable,
  });
  return { created: true, role: "rider", phone };
}

async function main() {
  const store = createStore(requiredDatabaseUrl());

  const accounts = [
    {
      kind: "user",
      name: config.devAdmin.name,
      phone: config.devAdmin.phone,
      password: config.devAdmin.password,
    },
    {
      kind: "user",
      name: config.devCustomer.name,
      phone: config.devCustomer.phone,
      password: config.devCustomer.password,
    },
    {
      kind: "rider",
      name: process.env.DEV_RIDER_NAME || "Wasel Rider",
      phone: process.env.DEV_RIDER_PHONE || "+966500000000",
      password: process.env.DEV_RIDER_PASSWORD || "secret123",
      currentLat: 24.7136,
      currentLng: 46.6753,
      isAvailable: true,
    },
  ];

  const results = [];
  for (const account of accounts) {
    if (account.kind === "rider") {
      results.push(await ensureRider(store, account));
    } else {
      results.push(await ensureUser(store, account));
    }
  }

  console.log(JSON.stringify({ seeded: results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
