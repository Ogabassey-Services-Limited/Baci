-- Fix merchant slug trigger to only generate slug when NULL or empty
-- This allows manual slug updates to persist

CREATE OR REPLACE FUNCTION generate_merchant_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Only generate slug if it's NULL or empty (preserve manual overrides)
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(regexp_replace(NEW.business_name, E'[^\\w]+', '-', 'g'));
  END IF;
  RETURN NEW;
END;
$$;

-- Update ogabassey merchant slug
UPDATE merchants SET slug = 'ogabassey' WHERE id = '6b5cb8a4-5575-456c-b936-8cdfae30db74';
