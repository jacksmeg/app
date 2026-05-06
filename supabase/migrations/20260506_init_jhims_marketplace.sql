create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('buyer', 'seller', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'product_condition') then
    create type public.product_condition as enum ('New', 'Used');
  end if;
  if not exists (select 1 from pg_type where typname = 'delivery_option') then
    create type public.delivery_option as enum ('Pickup', 'Seller Delivery', 'JHIMS Rider');
  end if;
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum ('Pending', 'Accepted', 'Paid', 'Packed', 'Out for Delivery', 'Delivered', 'Completed', 'Rejected', 'Reviewing');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_method_kind') then
    create type public.payment_method_kind as enum ('Mobile Money', 'Card', 'Bank Transfer', 'Wallet', 'Cash on Delivery', 'Escrow');
  end if;
  if not exists (select 1 from pg_type where typname = 'complaint_status') then
    create type public.complaint_status as enum ('Open', 'Reviewing', 'Resolved');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum ('Held in Escrow', 'Settled', 'Pending Confirmation', 'Refunded');
  end if;
  if not exists (select 1 from pg_type where typname = 'payout_status') then
    create type public.payout_status as enum ('Pending', 'Approved', 'Paid');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'buyer',
  phone text,
  location text not null default 'Accra',
  avatar_url text,
  verified boolean not null default false,
  banned boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.seller_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  shop_name text not null,
  bio text,
  response_time_minutes integer not null default 15,
  rating numeric(3,2) not null default 0,
  review_count integer not null default 0,
  subscription_tier text not null default 'Starter',
  payout_enabled boolean not null default false,
  stripe_account_id text,
  stripe_onboarding_complete boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  name text not null,
  category text not null check (category in ('Electronics', 'Fashion', 'Home', 'Vehicles', 'Beauty', 'Groceries')),
  description text not null,
  price numeric(12,2) not null check (price >= 0),
  discount_price numeric(12,2),
  location text not null,
  stock integer not null default 0 check (stock >= 0),
  condition public.product_condition not null default 'New',
  delivery_options public.delivery_option[] not null default array['JHIMS Rider']::public.delivery_option[],
  escrow_eligible boolean not null default false,
  featured boolean not null default false,
  published boolean not null default true,
  rating numeric(3,2) not null default 0,
  review_count integer not null default 0,
  cover_image_path text,
  cover_image_url text,
  art_label text not null default 'JHIMS',
  palette_a text not null default '#00b53f',
  palette_b text not null default '#f68b1e',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (cart_id, product_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.seller_profiles(id) on delete restrict,
  status public.order_status not null default 'Pending',
  payment_method public.payment_method_kind not null,
  escrow_held boolean not null default false,
  delivery_option public.delivery_option not null,
  location text not null,
  subtotal numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  eta text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  method public.payment_method_kind not null,
  status public.payment_status not null default 'Pending Confirmation',
  provider text not null default 'stripe',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  settled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (order_id, product_id, buyer_id)
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  target_id uuid,
  target_type text not null check (target_type in ('Product', 'Seller', 'Buyer')),
  reason text not null,
  severity text not null check (severity in ('Low', 'Medium', 'High')),
  status public.complaint_status not null default 'Open',
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  status public.payout_status not null default 'Pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  note text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_products_seller on public.products(seller_id);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_orders_buyer on public.orders(buyer_id);
create index if not exists idx_orders_seller on public.orders(seller_id);
create index if not exists idx_payments_order on public.payments(order_id);
create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at desc);
create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);
create index if not exists idx_delivery_events_order on public.delivery_events(order_id, created_at asc);

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'buyer'::public.app_role);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select public.current_app_role()) = 'admin'::public.app_role;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  signup_role public.app_role;
begin
  signup_role := case
    when new.raw_user_meta_data ->> 'role' = 'seller' then 'seller'::public.app_role
    else 'buyer'::public.app_role
  end;

  insert into public.profiles (id, full_name, role, phone, location)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'JHIMS User'), '@', 1)),
    signup_role,
    new.raw_user_meta_data ->> 'phone',
    coalesce(new.raw_user_meta_data ->> 'location', 'Accra')
  )
  on conflict (id) do nothing;

  insert into public.carts (buyer_id)
  values (new.id)
  on conflict (buyer_id) do nothing;

  if signup_role = 'seller' then
    insert into public.seller_profiles (id, shop_name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'shop_name', concat(coalesce(new.raw_user_meta_data ->> 'full_name', 'JHIMS Seller'), ' Shop')))
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.notify_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.delivery_events (order_id, status, note, created_by)
    values (
      new.id,
      new.status,
      case
        when new.status = 'Accepted' then 'Seller accepted the order and is preparing fulfilment.'
        when new.status = 'Paid' then 'Payment has been confirmed for this order.'
        when new.status = 'Packed' then 'Order has been packed and is ready for dispatch.'
        when new.status = 'Out for Delivery' then 'Order is with the rider or seller for final delivery.'
        when new.status = 'Delivered' then 'Delivery was marked complete and is awaiting buyer confirmation.'
        when new.status = 'Completed' then 'Order was completed successfully.'
        when new.status = 'Rejected' then 'Seller rejected the order.'
        else 'Order status changed.'
      end,
      coalesce(new.seller_id, old.seller_id)
    );

    insert into public.notifications (user_id, kind, title, body)
    values
      (new.buyer_id, 'order', 'Order update', concat('Order ', new.id, ' is now ', new.status, '.')),
      (new.seller_id, 'order', 'Order update', concat('Order ', new.id, ' is now ', new.status, '.'));
  end if;

  return new;
end;
$$;

create or replace function public.notify_message_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_id uuid;
  convo public.conversations;
begin
  select * into convo from public.conversations where id = new.conversation_id;

  update public.conversations
  set updated_at = timezone('utc', now())
  where id = new.conversation_id;

  recipient_id := case when convo.buyer_id = new.sender_id then convo.seller_id else convo.buyer_id end;

  insert into public.notifications (user_id, kind, title, body)
  values (
    recipient_id,
    'message',
    'New message',
    left(new.body, 120)
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists trg_seller_profiles_updated_at on public.seller_profiles;
create trigger trg_seller_profiles_updated_at before update on public.seller_profiles for each row execute procedure public.set_updated_at();
drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at before update on public.products for each row execute procedure public.set_updated_at();
drop trigger if exists trg_carts_updated_at on public.carts;
create trigger trg_carts_updated_at before update on public.carts for each row execute procedure public.set_updated_at();
drop trigger if exists trg_cart_items_updated_at on public.cart_items;
create trigger trg_cart_items_updated_at before update on public.cart_items for each row execute procedure public.set_updated_at();
drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at before update on public.orders for each row execute procedure public.set_updated_at();
drop trigger if exists trg_orders_notify_change on public.orders;
create trigger trg_orders_notify_change after update on public.orders for each row execute procedure public.notify_order_status_change();
drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at before update on public.payments for each row execute procedure public.set_updated_at();
drop trigger if exists trg_complaints_updated_at on public.complaints;
create trigger trg_complaints_updated_at before update on public.complaints for each row execute procedure public.set_updated_at();
drop trigger if exists trg_payout_requests_updated_at on public.payout_requests;
create trigger trg_payout_requests_updated_at before update on public.payout_requests for each row execute procedure public.set_updated_at();
drop trigger if exists trg_conversations_updated_at on public.conversations;
create trigger trg_conversations_updated_at before update on public.conversations for each row execute procedure public.set_updated_at();
drop trigger if exists trg_messages_notify_created on public.messages;
create trigger trg_messages_notify_created after insert on public.messages for each row execute procedure public.notify_message_created();

alter table public.profiles enable row level security;
alter table public.seller_profiles enable row level security;
alter table public.products enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.complaints enable row level security;
alter table public.payout_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.delivery_events enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles for update to authenticated using ((select auth.uid()) = id or (select public.is_admin())) with check ((select auth.uid()) = id or (select public.is_admin()));

drop policy if exists "seller_profiles_select" on public.seller_profiles;
create policy "seller_profiles_select" on public.seller_profiles for select to authenticated using (true);
drop policy if exists "seller_profiles_upsert" on public.seller_profiles;
create policy "seller_profiles_upsert" on public.seller_profiles for all to authenticated using ((select auth.uid()) = id or (select public.is_admin())) with check ((select auth.uid()) = id or (select public.is_admin()));

drop policy if exists "products_select" on public.products;
create policy "products_select" on public.products for select to authenticated using (published or seller_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "products_insert" on public.products;
create policy "products_insert" on public.products for insert to authenticated with check (seller_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "products_update" on public.products;
create policy "products_update" on public.products for update to authenticated using (seller_id = (select auth.uid()) or (select public.is_admin())) with check (seller_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "products_delete" on public.products;
create policy "products_delete" on public.products for delete to authenticated using (seller_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "carts_owner" on public.carts;
create policy "carts_owner" on public.carts for all to authenticated using (buyer_id = (select auth.uid()) or (select public.is_admin())) with check (buyer_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "cart_items_owner" on public.cart_items;
create policy "cart_items_owner" on public.cart_items for all to authenticated using (
  exists (select 1 from public.carts where carts.id = cart_items.cart_id and (carts.buyer_id = (select auth.uid()) or (select public.is_admin())))
) with check (
  exists (select 1 from public.carts where carts.id = cart_items.cart_id and (carts.buyer_id = (select auth.uid()) or (select public.is_admin())))
);

drop policy if exists "orders_access" on public.orders;
create policy "orders_access" on public.orders for select to authenticated using (
  buyer_id = (select auth.uid()) or seller_id = (select auth.uid()) or (select public.is_admin())
);
drop policy if exists "orders_insert" on public.orders;
create policy "orders_insert" on public.orders for insert to authenticated with check (
  buyer_id = (select auth.uid()) or (select public.is_admin())
);
drop policy if exists "orders_update" on public.orders;
create policy "orders_update" on public.orders for update to authenticated using (
  buyer_id = (select auth.uid()) or seller_id = (select auth.uid()) or (select public.is_admin())
) with check (
  buyer_id = (select auth.uid()) or seller_id = (select auth.uid()) or (select public.is_admin())
);

drop policy if exists "order_items_access" on public.order_items;
create policy "order_items_access" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders where orders.id = order_items.order_id and (orders.buyer_id = (select auth.uid()) or orders.seller_id = (select auth.uid()) or (select public.is_admin())))
);
drop policy if exists "order_items_insert" on public.order_items;
create policy "order_items_insert" on public.order_items for insert to authenticated with check (
  exists (select 1 from public.orders where orders.id = order_items.order_id and (orders.buyer_id = (select auth.uid()) or (select public.is_admin())))
);

drop policy if exists "payments_access" on public.payments;
create policy "payments_access" on public.payments for select to authenticated using (
  buyer_id = (select auth.uid()) or seller_id = (select auth.uid()) or (select public.is_admin())
);
drop policy if exists "payments_insert" on public.payments;
create policy "payments_insert" on public.payments for insert to authenticated with check (
  buyer_id = (select auth.uid()) or (select public.is_admin())
);
drop policy if exists "payments_update_admin" on public.payments;
create policy "payments_update_admin" on public.payments for update to authenticated using (
  buyer_id = (select auth.uid()) or seller_id = (select auth.uid()) or (select public.is_admin())
) with check (
  buyer_id = (select auth.uid()) or seller_id = (select auth.uid()) or (select public.is_admin())
);

drop policy if exists "reviews_select" on public.reviews;
create policy "reviews_select" on public.reviews for select to authenticated using (true);
drop policy if exists "reviews_insert_buyer" on public.reviews;
create policy "reviews_insert_buyer" on public.reviews for insert to authenticated with check (
  buyer_id = (select auth.uid())
  and exists (
    select 1
    from public.orders
    where orders.id = reviews.order_id
      and orders.buyer_id = (select auth.uid())
      and orders.status in ('Delivered', 'Completed')
  )
);

drop policy if exists "complaints_access" on public.complaints;
create policy "complaints_access" on public.complaints for select to authenticated using (
  reporter_id = (select auth.uid())
  or (target_type = 'Seller' and target_id = (select auth.uid()))
  or (select public.is_admin())
);
drop policy if exists "complaints_insert" on public.complaints;
create policy "complaints_insert" on public.complaints for insert to authenticated with check (
  reporter_id = (select auth.uid())
);
drop policy if exists "complaints_update" on public.complaints;
create policy "complaints_update" on public.complaints for update to authenticated using (
  reporter_id = (select auth.uid()) or (select public.is_admin())
) with check (
  reporter_id = (select auth.uid()) or (select public.is_admin())
);

drop policy if exists "payout_requests_access" on public.payout_requests;
create policy "payout_requests_access" on public.payout_requests for select to authenticated using (
  seller_id = (select auth.uid()) or (select public.is_admin())
);
drop policy if exists "payout_requests_insert" on public.payout_requests;
create policy "payout_requests_insert" on public.payout_requests for insert to authenticated with check (
  seller_id = (select auth.uid()) or (select public.is_admin())
);
drop policy if exists "payout_requests_update" on public.payout_requests;
create policy "payout_requests_update" on public.payout_requests for update to authenticated using (
  seller_id = (select auth.uid()) or (select public.is_admin())
) with check (
  seller_id = (select auth.uid()) or (select public.is_admin())
);

drop policy if exists "conversations_access" on public.conversations;
create policy "conversations_access" on public.conversations for all to authenticated using (
  buyer_id = (select auth.uid()) or seller_id = (select auth.uid()) or (select public.is_admin())
) with check (
  buyer_id = (select auth.uid()) or seller_id = (select auth.uid()) or (select public.is_admin())
);

drop policy if exists "messages_access" on public.messages;
create policy "messages_access" on public.messages for select to authenticated using (
  exists (
    select 1 from public.conversations
    where conversations.id = messages.conversation_id
      and (conversations.buyer_id = (select auth.uid()) or conversations.seller_id = (select auth.uid()) or (select public.is_admin()))
  )
);
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages for insert to authenticated with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.conversations
    where conversations.id = messages.conversation_id
      and (conversations.buyer_id = (select auth.uid()) or conversations.seller_id = (select auth.uid()) or (select public.is_admin()))
  )
);

drop policy if exists "notifications_access" on public.notifications;
create policy "notifications_access" on public.notifications for select to authenticated using (
  user_id = (select auth.uid()) or (select public.is_admin())
);
drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications for update to authenticated using (
  user_id = (select auth.uid()) or (select public.is_admin())
) with check (
  user_id = (select auth.uid()) or (select public.is_admin())
);
drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert" on public.notifications for insert to authenticated with check (
  user_id = (select auth.uid()) or (select public.is_admin())
);

drop policy if exists "delivery_events_access" on public.delivery_events;
create policy "delivery_events_access" on public.delivery_events for select to authenticated using (
  exists (
    select 1 from public.orders
    where orders.id = delivery_events.order_id
      and (orders.buyer_id = (select auth.uid()) or orders.seller_id = (select auth.uid()) or (select public.is_admin()))
  )
);
drop policy if exists "delivery_events_insert" on public.delivery_events;
create policy "delivery_events_insert" on public.delivery_events for insert to authenticated with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.orders
    where orders.id = delivery_events.order_id
      and (orders.seller_id = (select auth.uid()) or (select public.is_admin()))
  )
);

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_insert" on storage.objects;
create policy "product_images_insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'product-images'
);
drop policy if exists "product_images_update" on storage.objects;
create policy "product_images_update" on storage.objects for update to authenticated using (
  bucket_id = 'product-images' and (owner_id = (select auth.uid()::text) or (select public.is_admin()))
) with check (
  bucket_id = 'product-images' and (owner_id = (select auth.uid()::text) or (select public.is_admin()))
);
drop policy if exists "product_images_delete" on storage.objects;
create policy "product_images_delete" on storage.objects for delete to authenticated using (
  bucket_id = 'product-images' and (owner_id = (select auth.uid()::text) or (select public.is_admin()))
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'delivery_events'
  ) then
    alter publication supabase_realtime add table public.delivery_events;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
