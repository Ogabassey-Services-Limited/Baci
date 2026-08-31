-- Keep the marketplace country constraint aligned with the countries exposed by
-- the Jumia Vendor API. The baseline constraint predates Algeria and Tunisia
-- support and still permits Tanzania, which Jumia does not expose.
ALTER TABLE public.marketplace_integrations
  DROP CONSTRAINT IF EXISTS marketplace_integrations_country_code_check;

ALTER TABLE public.marketplace_integrations
  ADD CONSTRAINT marketplace_integrations_country_code_check
  CHECK (
    country_code = ANY (
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
