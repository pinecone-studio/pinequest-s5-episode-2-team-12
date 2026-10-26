-- Phase 7: gems (💎) and the shop. Gems are a ledger (gem_events, like xp_events): the balance is a sum and
-- never a column a client can write. Students buy through purchase_item(), which locks the student's ledger,
-- checks the balance and writes the purchase, the negative gem event and the inventory row together — and
-- returns the first result again when the same idempotency key comes back (double taps, retries).
-- There are no real-money purchases.

create table if not exists public.gem_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  amount int not null check (amount <> 0 and amount between -10000 and 1000),
  reason text not null check (char_length(reason) <= 40),
  key text not null check (char_length(key) <= 120),
  at timestamptz not null default now(),
  unique (user_id, key)
);

-- prices live here so the database, not the browser, decides what a purchase costs
-- (keep in sync with src/features/shop/catalog.ts; shop.test.ts checks the two match)
create table if not exists public.shop_items (
  id text primary key,
  kind text not null check (kind in ('consumable', 'frame', 'outfit', 'skin', 'banner')),
  price int not null check (price > 0),
  qty int not null default 1 check (qty > 0),
  active boolean not null default true
);
insert into public.shop_items (id, kind, price, qty) values
  ('streak-freeze', 'consumable', 30, 1),
  ('hints-3', 'consumable', 40, 3),
  ('frame-gold', 'frame', 80, 1),
  ('frame-lime', 'frame', 80, 1),
  ('frame-sky', 'frame', 80, 1),
  ('outfit-hat', 'outfit', 120, 1),
  ('outfit-scarf', 'outfit', 120, 1),
  ('outfit-glasses', 'outfit', 120, 1),
  ('outfit-crown', 'outfit', 200, 1),
  ('skin-winter', 'skin', 300, 1),
  ('skin-night', 'skin', 300, 1),
  ('banner-steppe', 'banner', 60, 1),
  ('banner-sunset', 'banner', 60, 1),
  ('banner-night', 'banner', 60, 1)
on conflict (id) do update set kind = excluded.kind, price = excluded.price, qty = excluded.qty, active = true;

create table if not exists public.inventory (
  user_id uuid not null references auth.users on delete cascade,
  item_id text not null references public.shop_items,
  qty int not null default 0 check (qty >= 0),
  equipped boolean not null default false,
  primary key (user_id, item_id)
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  item_id text not null references public.shop_items,
  price int not null,
  idem_key text not null check (char_length(idem_key) between 8 and 80),
  at timestamptz not null default now(),
  unique (user_id, idem_key)
);

alter table public.gem_events enable row level security;
alter table public.shop_items enable row level security;
alter table public.inventory enable row level security;
alter table public.purchases enable row level security;
create policy "own gems" on public.gem_events for select using (auth.uid() = user_id);
create policy "shop is public" on public.shop_items for select using (true);
create policy "own inventory" on public.inventory for select using (auth.uid() = user_id);
create policy "own purchases" on public.purchases for select using (auth.uid() = user_id);

create or replace function public.purchase_item(p_item text, p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  it public.shop_items;
  prior public.purchases;
  bal int;
  owned int;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  -- one purchase at a time per student
  perform pg_advisory_xact_lock(hashtext(uid::text));

  select * into prior from public.purchases where user_id = uid and idem_key = p_key;
  if found then
    return jsonb_build_object('ok', true, 'repeated', true, 'item', prior.item_id);
  end if;

  select * into it from public.shop_items where id = p_item and active;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_item'); end if;

  select coalesce(qty, 0) into owned from public.inventory where user_id = uid and item_id = p_item;
  if it.kind <> 'consumable' and coalesce(owned, 0) > 0 then
    return jsonb_build_object('ok', false, 'reason', 'owned');
  end if;

  select coalesce(sum(amount), 0) into bal from public.gem_events where user_id = uid;
  if bal < it.price then return jsonb_build_object('ok', false, 'reason', 'insufficient'); end if;

  insert into public.purchases (user_id, item_id, price, idem_key) values (uid, p_item, it.price, p_key);
  insert into public.gem_events (user_id, amount, reason, key)
    values (uid, -it.price, 'buy:' || p_item, 'buy:' || p_key);
  insert into public.inventory (user_id, item_id, qty) values (uid, p_item, it.qty)
    on conflict (user_id, item_id) do update set qty = public.inventory.qty + excluded.qty;

  return jsonb_build_object('ok', true, 'repeated', false, 'item', p_item, 'balance', bal - it.price);
end;
$$;

revoke all on function public.purchase_item(text, text) from public, anon;
grant execute on function public.purchase_item(text, text) to authenticated;
