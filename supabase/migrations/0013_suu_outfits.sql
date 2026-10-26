-- Add the supplied Suu wardrobe. Existing purchases and inventory stay intact.
insert into public.shop_items (id, kind, price, qty) values
  ('outfit-school-suit', 'outfit', 120, 1),
  ('outfit-school-bow', 'outfit', 120, 1),
  ('outfit-deel-blue', 'outfit', 180, 1),
  ('outfit-deel-red', 'outfit', 180, 1),
  ('outfit-deel-green', 'outfit', 220, 1),
  ('outfit-deel-gold', 'outfit', 180, 1),
  ('outfit-knit-glasses', 'outfit', 140, 1),
  ('outfit-scholar', 'outfit', 140, 1),
  ('outfit-beret', 'outfit', 140, 1),
  ('outfit-varsity', 'outfit', 140, 1),
  ('outfit-winter-knit', 'outfit', 140, 1),
  ('outfit-gardener', 'outfit', 160, 1),
  ('outfit-graduate', 'outfit', 220, 1),
  ('outfit-summer', 'outfit', 160, 1),
  ('outfit-mint-hoodie', 'outfit', 120, 1),
  ('outfit-denim', 'outfit', 120, 1),
  ('outfit-heart', 'outfit', 120, 1),
  ('outfit-stripes', 'outfit', 120, 1),
  ('outfit-sherpa', 'outfit', 140, 1),
  ('outfit-tracksuit', 'outfit', 140, 1)
on conflict (id) do update set kind = excluded.kind, price = excluded.price, qty = excluded.qty, active = true;
