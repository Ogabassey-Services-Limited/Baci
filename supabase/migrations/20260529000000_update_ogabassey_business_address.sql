-- Migration to update merchant business address to replace the regression string 'rwltza'
-- Target: slug = 'ogabassey'
UPDATE public.merchants
SET business_address = 'Taiyelolu Towers, First Floor, 2 Olaide Tomori Street, Ikeja, Lagos',
    updated_at = now()
WHERE slug = 'ogabassey';
