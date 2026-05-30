-- Data repair: replace the regressed Ogabassey business_address value.
-- Owner confirmed this address must not include "Off Allen Avenue".
-- Target the stable merchant id and keep the canonical slug as a safety check.
UPDATE public.merchants
SET business_address = 'Taiyelolu Towers, First Floor, 2 Olaide Tomori Street, Ikeja, Lagos',
    updated_at = now()
WHERE id = '6b5cb8a4-5575-456c-b936-8cdfae30db74'::uuid
  AND slug = 'ogabassey'
  AND business_address IS DISTINCT FROM 'Taiyelolu Towers, First Floor, 2 Olaide Tomori Street, Ikeja, Lagos';
