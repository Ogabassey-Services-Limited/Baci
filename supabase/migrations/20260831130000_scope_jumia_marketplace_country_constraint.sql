-- The preceding Jumia country migration was authored against a shared
-- marketplace constraint. Scope the Jumia country list to Jumia rows so
-- non-Jumia integrations retain the countries supported by their providers.
ALTER TABLE public.marketplace_integrations
  DROP CONSTRAINT IF EXISTS marketplace_integrations_country_code_check;

ALTER TABLE public.marketplace_integrations
  ADD CONSTRAINT marketplace_integrations_country_code_check
  CHECK (
    platform IS DISTINCT FROM 'jumia'::text
    OR country_code = ANY (
      ARRAY[
        'DZ'::text,
        'EG'::text,
        'GH'::text,
        'CI'::text,
        'KE'::text,
        'MA'::text,
        'NG'::text,
        'SN'::text,
        'TN'::text,
        'UG'::text,
        'ZA'::text
      ]
    )
  );
