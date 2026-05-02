# Wasel Delivery MVP

Wasel is a lean package-delivery MVP based on the supplied specification. The repo is split into three apps:

- `apps/api`: Node.js + Express API for auth, users, orders, pricing, and status updates.
- `apps/mobile`: Expo Router mobile app for customer signup, booking, order tracking, and profile.
- `apps/admin`: Minimal React admin dashboard for viewing orders and updating status.
- `database/schema.sql`: PostgreSQL schema ready for Supabase or a managed Postgres database.

## Local Setup

```bash
cd wasel
npm install
cp .env.example apps/api/.env
npm run dev:api
```

In another terminal:

```bash
npm run dev:admin
npm run dev:mobile
```

The API runs on `http://localhost:4000` by default. Without `DATABASE_URL`, it stores data in memory so you can test the MVP flow immediately.

## Local Admin Login

For local in-memory development, the API seeds this account on startup:

- Phone: `+966500001234`
- Password: `secret123`
- Admin key: `wasel-dev-admin`

You can change these with `DEV_ADMIN_PHONE`, `DEV_ADMIN_PASSWORD`, and `ADMIN_API_KEY`.

## Local Customer Login

For testing the customer mobile app, the API also seeds this user:

- Phone: `+966500009999`
- Password: `secret123`

You can change it with `DEV_CUSTOMER_PHONE` and `DEV_CUSTOMER_PASSWORD`.

For a browser preview of the customer app, run:

```bash
npm --workspace apps/mobile run web
```

Then open `http://localhost:8081`.

## API Summary

- `POST /auth/signup`
- `POST /auth/login`
- `GET /users/me`
- `POST /users/push-token`
- `POST /orders`
- `GET /orders`
- `GET /orders/:id`
- `PATCH /orders/:id/status`

## MVP Assumptions

- Login uses phone + password for the first MVP. OTP can replace this later.
- Pricing is flat by package type and urgency: documents, small, medium, large, and optional express.
- Admin updates are protected by `x-admin-key` only when `ADMIN_API_KEY` is configured.
- Push notifications are modeled through Expo push tokens; sending notifications can be added after Expo credentials are finalized.

## Database

Run `database/schema.sql` in Supabase SQL Editor or any PostgreSQL database, then set `DATABASE_URL` in `apps/api/.env`.

For pure local testing, leave `DATABASE_URL` empty and the API will use in-memory data.

## Environment

Mobile can point at a deployed API with:

```bash
EXPO_PUBLIC_API_URL=https://your-api.example.com npm run dev:mobile
```

Admin can point at a deployed API with:

```bash
VITE_API_URL=https://your-api.example.com npm run dev:admin
```
