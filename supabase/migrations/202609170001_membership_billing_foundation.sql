-- Membership and billing foundation. Additive migration; existing application tables are untouched.
begin;

create extension if not exists pgcrypto;

alter table public.teacher_profiles
  add column if not exists paid_until timestamptz,
  add column if not exists subscription_status text not null default 'trial',
  add column if not exists recovery_email text;

do $$ begin
  alter table public.teacher_profiles
    add constraint teacher_profiles_subscription_status_check
    check (subscription_status in ('trial', 'active', 'past_due', 'expired', 'suspended'));
exception when duplicate_object then null;
end $$;

create table if not exists public.subscription_plans (
  id text primary key,
  name text not null,
  duration_days integer not null check (duration_days > 0),
  price_satang integer not null check (price_satang >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher_profiles(teacher_id) on delete restrict,
  plan_id text references public.subscription_plans(id) on delete restrict,
  amount_satang integer not null check (amount_satang > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired', 'refunded')),
  gateway text,
  gateway_charge_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_orders_gateway_charge_unique unique (gateway_charge_id)
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.payment_orders(id) on delete set null,
  gateway text not null,
  gateway_event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint payment_events_gateway_event_unique unique (gateway, gateway_event_id)
);

create index if not exists teacher_profiles_paid_until_idx on public.teacher_profiles (paid_until);
create index if not exists payment_orders_teacher_created_idx on public.payment_orders (teacher_id, created_at desc);

alter table public.subscription_plans enable row level security;
alter table public.payment_orders enable row level security;
alter table public.payment_events enable row level security;

drop policy if exists subscription_plans_public_read on public.subscription_plans;
create policy subscription_plans_public_read on public.subscription_plans
  for select to authenticated using (active = true);

drop policy if exists payment_orders_owner_read on public.payment_orders;
create policy payment_orders_owner_read on public.payment_orders
  for select to authenticated using (teacher_id = (select auth.uid()));

drop policy if exists payment_orders_owner_insert on public.payment_orders;
create policy payment_orders_owner_insert on public.payment_orders
  for insert to authenticated with check (
    teacher_id = (select auth.uid()) and status = 'pending'
  );

drop policy if exists payment_events_owner_read on public.payment_events;
create policy payment_events_owner_read on public.payment_events
  for select to authenticated using (
    exists (select 1 from public.payment_orders o where o.id = payment_events.order_id and o.teacher_id = (select auth.uid()))
  );

commit;
