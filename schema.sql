-- Shopmate production schema additions.
-- Run in Supabase SQL Editor after the base shops/products/faqs tables exist.

alter table public.products
  add column if not exists stock_quantity integer not null default 0;

alter table public.products
  add column if not exists sku text;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade not null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'fulfilled')),
  subtotal numeric(12,2) not null default 0,
  gst numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete restrict not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  shop_id uuid references public.shops(id) on delete cascade not null,
  invoice_number text not null,
  gstin text,
  subtotal numeric(12,2) not null default 0,
  gst numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (shop_id, invoice_number)
);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.invoices enable row level security;

-- Public visitors can browse catalog content but cannot read owner data.
drop policy if exists "public read products" on public.products;
create policy "public read products"
on public.products for select
to anon, authenticated
using (true);

drop policy if exists "public read faqs" on public.faqs;
create policy "public read faqs"
on public.faqs for select
to anon, authenticated
using (true);

-- Visitors can create an order request, but only shop owners can read/update orders.
drop policy if exists "public create orders" on public.orders;
create policy "public create orders"
on public.orders for insert
to anon, authenticated
with check (true);

drop policy if exists "owners read orders" on public.orders;
create policy "owners read orders"
on public.orders for select
to authenticated
using (exists (
  select 1 from public.shops
  where shops.id = orders.shop_id
  and shops.owner_id = auth.uid()
));

drop policy if exists "owners update orders" on public.orders;
create policy "owners update orders"
on public.orders for update
to authenticated
using (exists (
  select 1 from public.shops
  where shops.id = orders.shop_id
  and shops.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.shops
  where shops.id = orders.shop_id
  and shops.owner_id = auth.uid()
));

-- Order items follow the order's public insert / owner read boundary.
drop policy if exists "public create order items" on public.order_items;
create policy "public create order items"
on public.order_items for insert
to anon, authenticated
with check (exists (
  select 1 from public.orders
  where orders.id = order_items.order_id
));

drop policy if exists "owners read order items" on public.order_items;
create policy "owners read order items"
on public.order_items for select
to authenticated
using (exists (
  select 1
  from public.orders
  join public.shops on shops.id = orders.shop_id
  where orders.id = order_items.order_id
  and shops.owner_id = auth.uid()
));

-- Invoices are owner-only.
drop policy if exists "owners manage invoices" on public.invoices;
create policy "owners manage invoices"
on public.invoices for all
to authenticated
using (exists (
  select 1 from public.shops
  where shops.id = invoices.shop_id
  and shops.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.shops
  where shops.id = invoices.shop_id
  and shops.owner_id = auth.uid()
));

-- Atomic stock decrement. Call this from an Edge Function for real checkout.
create or replace function public.reduce_product_stock(
  requested_product_id uuid,
  requested_quantity integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  available_quantity integer;
begin
  if requested_quantity is null or requested_quantity <= 0 then
    return false;
  end if;

  select stock_quantity into available_quantity
  from public.products
  where id = requested_product_id
  for update;

  if available_quantity is null or available_quantity < requested_quantity then
    return false;
  end if;

  update public.products
  set stock_quantity = stock_quantity - requested_quantity,
      in_stock = stock_quantity - requested_quantity > 0
  where id = requested_product_id;

  return true;
end;
$$;

revoke all on function public.reduce_product_stock(uuid, integer) from public;
grant execute on function public.reduce_product_stock(uuid, integer) to anon, authenticated;
