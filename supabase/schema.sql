-- Run this in Supabase SQL Editor for the QuickSuuq affiliate database.
-- Keep customer_mappings private. Do not enable public/anon access to these tables.

create extension if not exists pgcrypto;

do $$ begin
  create type public.commission_status as enum ('PENDING','APPROVED','PAID','VOIDED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payout_status as enum ('PENDING','PAID','FAILED');
exception when duplicate_object then null; end $$;

create table if not exists public.salespeople (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  phone text,
  hashed_pin text,
  commission_rate numeric(7,6) not null default 0.020000 check (commission_rate >= 0 and commission_rate <= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_mappings (
  normalized_phone varchar(32) primary key,
  salesperson_id uuid not null references public.salespeople(id) on delete restrict,
  first_order_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists customer_mappings_salesperson_id_idx on public.customer_mappings(salesperson_id);

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  shopify_order_id text not null unique,
  order_number text not null,
  salesperson_id uuid not null references public.salespeople(id) on delete restrict,
  currency char(3) not null default 'USD',
  eligible_amount numeric(12,2) not null check (eligible_amount >= 0),
  refunded_eligible_amount numeric(12,2) not null default 0 check (refunded_eligible_amount >= 0),
  commission_rate numeric(7,6) not null check (commission_rate >= 0 and commission_rate <= 1),
  commission_amount numeric(12,2) not null check (commission_amount >= 0),
  status public.commission_status not null default 'PENDING',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists commissions_salesperson_status_idx on public.commissions(salesperson_id,status);
create index if not exists commissions_created_at_idx on public.commissions(created_at desc);

create table if not exists public.shopify_refunds (
  shopify_refund_id text primary key,
  shopify_order_id text not null,
  refunded_eligible_amount numeric(12,2) not null default 0 check (refunded_eligible_amount >= 0),
  created_at timestamptz not null default now()
);
create index if not exists shopify_refunds_order_id_idx on public.shopify_refunds(shopify_order_id);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  salesperson_id uuid not null references public.salespeople(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null default 'EVC_PLUS' check (payment_method in ('EVC_PLUS','ZAAD','SAHAL','CASH','OTHER')),
  transaction_ref text,
  status public.payout_status not null default 'PAID',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payouts_salesperson_idx on public.payouts(salesperson_id,created_at desc);

create table if not exists public.payout_commissions (
  payout_id uuid not null references public.payouts(id) on delete restrict,
  commission_id uuid not null references public.commissions(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  primary key (payout_id,commission_id),
  unique (commission_id)
);

-- Webhook inbox makes delivery IDs auditable and helps with replay diagnostics.
create table if not exists public.webhook_events (
  id bigint generated always as identity primary key,
  shopify_webhook_id text unique,
  topic text not null,
  outcome text,
  received_at timestamptz not null default now()
);

-- Supabase API clients must not read these tables directly. The app server uses DATABASE_URL.
-- RLS is enabled as defense in depth; server-side PostgreSQL access still requires secure credentials.
alter table public.salespeople enable row level security;
alter table public.customer_mappings enable row level security;
alter table public.commissions enable row level security;
alter table public.shopify_refunds enable row level security;
alter table public.payouts enable row level security;
alter table public.payout_commissions enable row level security;
alter table public.webhook_events enable row level security;
