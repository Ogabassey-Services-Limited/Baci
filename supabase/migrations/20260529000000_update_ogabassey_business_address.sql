-- Data repair: replace the regressed Ogabassey business_address value.
-- Targeted tenant data repairs already exist in this migration history; keep
-- this update scoped to the merchant slug and avoid changing unrelated rows.
UPDATE public.merchants
SET business_address = 'Taiyelolu Towers, First Floor, 2 Olaide Tomori Street, Ikeja, Lagos',
    updated_at = now()
WHERE slug = 'ogabassey'
  AND business_address IS DISTINCT FROM 'Taiyelolu Towers, First Floor, 2 Olaide Tomori Street, Ikeja, Lagos';
