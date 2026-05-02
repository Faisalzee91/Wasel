# Wasel Implementation Notes

## Product Flow

1. Customer signs up or logs in with phone and password.
2. Customer creates an order with pickup, dropoff, and package size.
3. API calculates a flat price and stores the order as `pending`.
4. Admin reviews the order and changes status to `confirmed`, `assigned`, `delivered`, or `canceled`.
5. Customer sees status updates in the mobile app.

## Recommended Next Decisions

- Choose production auth mode: keep phone/password for MVP testing or move to Supabase Auth OTP.
- Choose maps/location provider if real geocoding or distance-based pricing is needed.
- Decide whether couriers need a separate app in phase two or can remain admin-managed.
- Define Wasel branding: colors, logo, Arabic/English support, and currency display.

## Current Build Decisions

- The app is RTL-first and uses the existing Wasel brand palette from the Obsidian notes.
- Pricing mirrors the manual launch model: simple SAR quote, no surge, no route optimization.
- The API is deployable with Postgres but can run locally without a database.
- The admin dashboard assumes Faisal or an operator manually moves orders through the dispatch workflow.
