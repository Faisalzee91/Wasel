# Wasel Session Handoff

## Project path

`/Users/faisalzafar/Desktop/Wasel/app`

## Current state

- MVP is working end to end:
  - customer app
  - rider app
  - admin dashboard
- Backend/API deployed on Render:
  - `https://wasel-api.onrender.com`
- Admin deployed on Render
- Database is Supabase/Postgres
- API health reports:
  - `{"ok":true,"app":"wasel-api","store":"postgres"}`

## Completed features

### Customer
- signup/login
- create delivery
- pickup + destination selection from map/current location
- recipient name + phone
- item count
- distance-based pricing
- payment step
- orders list
- order detail
- tracking

### Rider
- login
- live location updates
- nearby request matching
- accept/reject
- current delivery
- route handoff to Google Maps
- delivery completion with OTP

### Admin
- login
- orders/customer/rider visibility
- status updates

### Matching / pricing
- first rider acceptance wins
- fallback matching if no riders are inside strict radius
- dynamic pricing by distance
- `+5 SAR` surcharge for `4+` items
- express pricing supported

## OTP flows

### Delivery OTP
- rider taps `Mark as Delivered`
- backend generates OTP
- rider enters OTP before order becomes delivered
- OTP currently logs in API logs
- real SMS provider is **not** integrated yet

### Forgot password OTP
- user taps `Forgot password?`
- enters phone
- requests OTP
- enters OTP + new password
- password updates
- OTP currently logs in API logs
- real SMS provider is **not** integrated yet

## Recent UI/design work

- customer app moved to lighter premium style
- exact app background color set to:
  - `#F7F3EE`
- added intro splash:
  - full green screen
  - centered logo
  - fades/zooms into auth screen after about 2 seconds
- auth screen redesigned
- home, orders, track screens redesigned
- reduced oversized/zoomed UI elements
- recent orders cards scaled down
- added Track tab
- added back arrow on Create Delivery screen
- lifted bottom tab bar slightly higher

## Important files modified

### API
- `/Users/faisalzafar/Desktop/Wasel/app/apps/api/src/server.js`
- `/Users/faisalzafar/Desktop/Wasel/app/apps/api/src/store.js`
- `/Users/faisalzafar/Desktop/Wasel/app/database/schema.sql`

### Mobile
- `/Users/faisalzafar/Desktop/Wasel/app/apps/mobile/app/index.tsx`
- `/Users/faisalzafar/Desktop/Wasel/app/apps/mobile/app/booking.tsx`
- `/Users/faisalzafar/Desktop/Wasel/app/apps/mobile/app/(tabs)/home.tsx`
- `/Users/faisalzafar/Desktop/Wasel/app/apps/mobile/app/(tabs)/orders.tsx`
- `/Users/faisalzafar/Desktop/Wasel/app/apps/mobile/app/(tabs)/track.tsx`
- `/Users/faisalzafar/Desktop/Wasel/app/apps/mobile/app/(tabs)/_layout.tsx`
- `/Users/faisalzafar/Desktop/Wasel/app/apps/mobile/lib/api.ts`
- `/Users/faisalzafar/Desktop/Wasel/app/apps/mobile/lib/i18n.tsx`
- `/Users/faisalzafar/Desktop/Wasel/app/apps/mobile/components/ui.tsx`

## Supabase migrations still needed

Run these if they are not already in the live DB.

### Delivery OTP columns on `orders`

```sql
alter table orders add column if not exists delivery_otp_hash text;
alter table orders add column if not exists delivery_otp_expires_at timestamptz;
alter table orders add column if not exists delivery_otp_sent_at timestamptz;
```

### Forgot password OTP columns on `users`

```sql
alter table users add column if not exists password_reset_otp_hash text;
alter table users add column if not exists password_reset_otp_expires_at timestamptz;
alter table users add column if not exists password_reset_otp_sent_at timestamptz;
```

## Important decisions

- keep the existing Wasel green/light theme
- do **not** switch to dark UI
- shared mobile app still serves both customer and rider via role-based login
- Render is the current production host
- Supabase/Postgres is the production DB
- OTPs are implemented as MVP backend flows first, with code logged server-side until SMS is added

## Pending tasks

- push latest forgot-password + UI changes to GitHub
- let Render redeploy API/admin if needed
- run the missing Supabase migrations above
- integrate a real SMS provider for:
  - forgot password OTP
  - delivery completion OTP
- Notion updates are desired by the user but are not implemented yet
- App Store / Play Store readiness still pending:
  - EAS setup
  - bundle/package IDs
  - icons/screenshots/legal pages
  - push notifications
  - payment gateway
  - production hardening

## Useful run commands

### Mobile against live API

```bash
cd /Users/faisalzafar/Desktop/Wasel/app
EXPO_PUBLIC_API_URL=https://wasel-api.onrender.com npm --workspace apps/mobile run start -- --clear
```

### Local API

```bash
cd /Users/faisalzafar/Desktop/Wasel/app
npm --workspace apps/api run dev
```

## Test accounts

### Customer
- phone: `+966500009999`
- password: `secret123`

### Rider
- phone: `+966500000000`
- password: `secret123`

### Admin
- phone: `+966500001234`
- password: `secret123`
- admin key on Render is currently:
  - `wasel-dev-admin`

## Verification status

- API syntax checks passed
- mobile TypeScript compile passed
- admin build had passed previously
- Render API and admin are deployed and reachable
