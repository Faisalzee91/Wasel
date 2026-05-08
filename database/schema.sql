create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  password_hash text not null,
  push_token text,
  password_reset_otp_hash text,
  password_reset_otp_expires_at timestamptz,
  password_reset_otp_sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- OTP columns added after initial deploy
alter table users add column if not exists password_reset_otp_hash text;
alter table users add column if not exists password_reset_otp_expires_at timestamptz;
alter table users add column if not exists password_reset_otp_sent_at timestamptz;

create table if not exists couriers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  password_hash text not null,
  is_available boolean not null default true,
  current_lat double precision,
  current_lng double precision,
  active_order_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at added after initial deploy
alter table couriers add column if not exists updated_at timestamptz not null default now();

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  pickup_address text not null,
  dropoff_address text not null,
  recipient_name text not null,
  recipient_phone text not null,
  item_count integer not null default 1 check (item_count > 0),
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  dropoff_lat double precision not null,
  dropoff_lng double precision not null,
  item_description text not null,
  package_type text not null default 'small',
  urgency text not null default 'standard',
  payment_method text not null default 'stcpay',
  distance_km numeric(10,2) not null check (distance_km >= 0),
  price integer not null check (price > 0),
  status text not null default 'pending',
  courier_id uuid references couriers(id) on delete set null,
  delivery_otp_hash text,
  delivery_otp_expires_at timestamptz,
  delivery_otp_sent_at timestamptz,
  delivered_at timestamptz,
  estimated_delivery_minutes integer not null default 90,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_status_check check (status in ('pending', 'confirmed', 'assigned', 'delivered', 'canceled')),
  constraint orders_package_type_check check (package_type in ('documents', 'small', 'medium', 'large')),
  constraint orders_urgency_check check (urgency in ('standard', 'express')),
  constraint orders_payment_method_check check (payment_method in ('stcpay', 'bank_transfer', 'apple_pay'))
);

-- columns added after initial deploy
alter table orders add column if not exists pickup_lat double precision;
alter table orders add column if not exists pickup_lng double precision;
alter table orders add column if not exists dropoff_lat double precision;
alter table orders add column if not exists dropoff_lng double precision;
alter table orders add column if not exists recipient_name text;
alter table orders add column if not exists recipient_phone text;
alter table orders add column if not exists item_count integer not null default 1;
alter table orders add column if not exists distance_km numeric(10,2);
alter table orders add column if not exists courier_id uuid;
alter table orders add column if not exists delivery_otp_hash text;
alter table orders add column if not exists delivery_otp_expires_at timestamptz;
alter table orders add column if not exists delivery_otp_sent_at timestamptz;
alter table orders add column if not exists delivered_at timestamptz;
alter table orders add column if not exists estimated_delivery_minutes integer not null default 90;
alter table orders add column if not exists updated_at timestamptz not null default now();
alter table orders add column if not exists canceled_at timestamptz;

alter table couriers
  drop constraint if exists couriers_active_order_id_fkey;

alter table couriers
  add constraint couriers_active_order_id_fkey
  foreign key (active_order_id)
  references orders(id)
  on delete set null;

create table if not exists order_matches (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  courier_id uuid not null references couriers(id) on delete cascade,
  distance_to_pickup_km numeric(10,2) not null check (distance_to_pickup_km >= 0),
  state text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_matches_unique unique (order_id, courier_id),
  constraint order_matches_state_check check (state in ('pending', 'accepted', 'rejected', 'expired'))
);

-- columns added after initial deploy
alter table order_matches add column if not exists distance_to_pickup_km numeric(10,2);
alter table order_matches add column if not exists state text not null default 'pending';
alter table order_matches add column if not exists updated_at timestamptz not null default now();

create index if not exists orders_user_id_created_at_idx on orders(user_id, created_at desc);
create index if not exists orders_status_created_at_idx on orders(status, created_at desc);
create index if not exists orders_courier_id_idx on orders(courier_id);
create index if not exists order_matches_courier_state_idx on order_matches(courier_id, state, created_at desc);
create index if not exists order_matches_order_state_idx on order_matches(order_id, state);
create index if not exists couriers_available_idx on couriers(is_available, active_order_id);
create index if not exists users_phone_idx on users(phone);
create index if not exists couriers_phone_idx on couriers(phone);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists orders_set_updated_at on orders;
create trigger orders_set_updated_at
before update on orders
for each row
execute function set_updated_at();

drop trigger if exists order_matches_set_updated_at on order_matches;
create trigger order_matches_set_updated_at
before update on order_matches
for each row
execute function set_updated_at();

drop trigger if exists couriers_set_updated_at on couriers;
create trigger couriers_set_updated_at
before update on couriers
for each row execute function set_updated_at();
