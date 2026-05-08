import dotenv from "dotenv";

dotenv.config({ path: new URL("../.env", import.meta.url) });

const isProduction = process.env.NODE_ENV === "production";

export const config = {
  port: Number(process.env.API_PORT || process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "dev-only-change-me",
  adminApiKey: process.env.ADMIN_API_KEY || (isProduction ? "" : "wasel-dev-admin"),
  databaseUrl: process.env.DATABASE_URL || "",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  apiBaseUrl: process.env.API_BASE_URL || "http://localhost:4000",
  devAdmin: {
    enabled: process.env.SEED_DEV_ADMIN !== "false" && !process.env.DATABASE_URL,
    name: process.env.DEV_ADMIN_NAME || "Wasel Admin",
    phone: process.env.DEV_ADMIN_PHONE || "+966500001234",
    password: process.env.DEV_ADMIN_PASSWORD || "secret123",
  },
  devCustomer: {
    enabled: process.env.SEED_DEV_CUSTOMER !== "false" && !process.env.DATABASE_URL,
    name: process.env.DEV_CUSTOMER_NAME || "Wasel Customer",
    phone: process.env.DEV_CUSTOMER_PHONE || "+966500009999",
    password: process.env.DEV_CUSTOMER_PASSWORD || "secret123",
  },
  devRiders:
    process.env.SEED_DEV_RIDERS === "false" || process.env.DATABASE_URL
      ? []
      : [
          {
            name: "Wasel Rider",
            phone: process.env.DEV_RIDER_PHONE || "+966500000000",
            password: process.env.DEV_RIDER_PASSWORD || "secret123",
            currentLat: 24.7136,
            currentLng: 46.6753,
            isAvailable: true,
          },
          {
            name: "Wasel Rider 2",
            phone: "+966500000001",
            password: "secret123",
            currentLat: 24.7176,
            currentLng: 46.6704,
            isAvailable: true,
          },
          {
            name: "Wasel Rider 3",
            phone: "+966500000002",
            password: "secret123",
            currentLat: 24.7589,
            currentLng: 46.6512,
            isAvailable: true,
          },
          {
            name: "Wasel Rider 4",
            phone: "+966500000003",
            password: "secret123",
            currentLat: 24.7743,
            currentLng: 46.7386,
            isAvailable: true,
          },
          {
            name: "Wasel Rider 5",
            phone: "+966500000004",
            password: "secret123",
            currentLat: 24.6895,
            currentLng: 46.6878,
            isAvailable: true,
          },
          {
            name: "Wasel Rider 6",
            phone: "+966500000005",
            password: "secret123",
            currentLat: 24.7971,
            currentLng: 46.6352,
            isAvailable: true,
          },
        ],
};
