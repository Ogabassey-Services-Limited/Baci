-- =============================================================================
-- Normalize + propagate merchant business_name changes.
--
-- Context: a merchant's display name lives in TWO places — the `merchants`
-- row AND the baked page-builder config (`page_configs`): the storefront
-- Header block's `storeName` prop and the HeroCarousel's first slide title
-- ("Welcome to <name>"). A name change previously updated only the row, so the
-- live storefront kept rendering the OLD name (the header block prop shadows the
-- live-name fallback in components/storefront/blocks/header.tsx). A hand edit
-- that left a trailing space ("Zorvexa ") exposed the same gap.
--
-- This migration adds two data-layer guarantees that hold no matter WHICH path
-- changes the name (the client-side `updateMerchant` hook, mobile onboarding, an
-- admin action, or a direct DB edit):
--
--   1. Normalization (BEFORE): trim ends + collapse internal whitespace runs on
--      business_name, so cosmetic corruption (trailing/duplicate spaces) can
--      never persist again.
--   2. Propagation (AFTER): when business_name actually changes, rewrite the
--      auto-baked name in this merchant's page_configs (draft + published) —
--      ONLY where a value still exactly matches the OLD name, so a merchant's
--      intentionally-customized store name or hero copy is left untouched.
--
-- Slugs/URLs are deliberately NOT touched here — those remain immutable
-- (see 20260517200500_lock_established_merchant_slugs.sql). This migration is
-- strictly about the human-readable display name.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Pure helper: rewrite the baked business name inside a Puck page config.
-- No table access; safe to mark IMMUTABLE. Returns the config unchanged when
-- there is nothing to rewrite (missing content array, no matching values).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rewrite_config_business_name(
  cfg jsonb,
  old_name text,
  new_name text
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'pg_catalog', 'public'
AS $$
  SELECT CASE
    WHEN cfg IS NULL
      OR old_name IS NULL OR old_name = ''
      OR new_name IS NULL OR new_name = ''
      OR jsonb_typeof(cfg -> 'content') <> 'array'
    THEN cfg
    ELSE jsonb_set(
      cfg,
      '{content}',
      COALESCE(
        (
          SELECT jsonb_agg(
            CASE
              -- Header block: storeName prop that still equals the old name.
              WHEN elem ->> 'type' = 'Header'
                   AND elem -> 'props' ->> 'storeName' = old_name
                THEN jsonb_set(elem, '{props,storeName}', to_jsonb(new_name))

              -- HeroCarousel: rewrite slide titles of the form "Welcome to <old>".
              WHEN elem ->> 'type' = 'HeroCarousel'
                   AND jsonb_typeof(elem -> 'props' -> 'slides') = 'array'
                THEN jsonb_set(
                  elem,
                  '{props,slides}',
                  COALESCE(
                    (
                      SELECT jsonb_agg(
                        CASE
                          WHEN slide ->> 'title' = 'Welcome to ' || old_name
                            THEN jsonb_set(
                              slide,
                              '{title}',
                              to_jsonb('Welcome to ' || new_name)
                            )
                          ELSE slide
                        END
                        ORDER BY ord
                      )
                      FROM jsonb_array_elements(elem -> 'props' -> 'slides')
                        WITH ORDINALITY AS s(slide, ord)
                    ),
                    elem -> 'props' -> 'slides'
                  )
                )

              ELSE elem
            END
            ORDER BY ord
          )
          FROM jsonb_array_elements(cfg -> 'content') WITH ORDINALITY AS c(elem, ord)
        ),
        cfg -> 'content'
      )
    )
  END;
$$;

-- ----------------------------------------------------------------------------
-- BEFORE trigger: normalize business_name whitespace on write.
-- Named with an `aa_` prefix so it runs before other BEFORE triggers
-- (e.g. slug generation) that may read the name.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_merchant_business_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  IF NEW.business_name IS NOT NULL THEN
    -- Collapse internal whitespace runs to a single space, then trim ends.
    NEW.business_name := btrim(regexp_replace(NEW.business_name, '\s+', ' ', 'g'));
    IF NEW.business_name = '' THEN
      NEW.business_name := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- AFTER trigger: propagate a committed name change into the baked page config.
-- SECURITY DEFINER so it reconciles page_configs regardless of the caller's
-- RLS context (client hook, mobile onboarding, admin, or direct edit).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.propagate_merchant_business_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  -- Only act on a real change with a concrete old value to match against.
  IF OLD.business_name IS DISTINCT FROM NEW.business_name
     AND OLD.business_name IS NOT NULL AND btrim(OLD.business_name) <> ''
     AND NEW.business_name IS NOT NULL AND btrim(NEW.business_name) <> ''
  THEN
    UPDATE public.page_configs pc
    SET
      draft_config = public.rewrite_config_business_name(
        pc.draft_config, OLD.business_name, NEW.business_name
      ),
      published_config = public.rewrite_config_business_name(
        pc.published_config, OLD.business_name, NEW.business_name
      )
    WHERE pc.merchant_id = NEW.id
      AND (
        pc.draft_config IS DISTINCT FROM public.rewrite_config_business_name(
          pc.draft_config, OLD.business_name, NEW.business_name
        )
        OR pc.published_config IS DISTINCT FROM public.rewrite_config_business_name(
          pc.published_config, OLD.business_name, NEW.business_name
        )
      );
  END IF;

  RETURN NULL; -- AFTER trigger: return value is ignored.
END;
$$;

-- Trigger helpers must never be directly invokable by public roles.
REVOKE ALL ON FUNCTION public.rewrite_config_business_name(jsonb, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rewrite_config_business_name(jsonb, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.rewrite_config_business_name(jsonb, text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.normalize_merchant_business_name() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_merchant_business_name() FROM anon;
REVOKE ALL ON FUNCTION public.normalize_merchant_business_name() FROM authenticated;
REVOKE ALL ON FUNCTION public.propagate_merchant_business_name() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.propagate_merchant_business_name() FROM anon;
REVOKE ALL ON FUNCTION public.propagate_merchant_business_name() FROM authenticated;

DROP TRIGGER IF EXISTS aa_normalize_merchant_business_name ON public.merchants;
CREATE TRIGGER aa_normalize_merchant_business_name
BEFORE INSERT OR UPDATE OF business_name ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION public.normalize_merchant_business_name();

DROP TRIGGER IF EXISTS propagate_merchant_business_name ON public.merchants;
CREATE TRIGGER propagate_merchant_business_name
AFTER UPDATE OF business_name ON public.merchants
FOR EACH ROW
WHEN (OLD.business_name IS DISTINCT FROM NEW.business_name)
EXECUTE FUNCTION public.propagate_merchant_business_name();

COMMENT ON FUNCTION public.rewrite_config_business_name(jsonb, text, text)
IS 'Rewrites the auto-baked merchant name (Header.storeName, HeroCarousel "Welcome to <name>" slide titles) inside a Puck page config; only exact old-name matches are changed.';
COMMENT ON FUNCTION public.normalize_merchant_business_name()
IS 'BEFORE trigger: trims and collapses whitespace in merchants.business_name.';
COMMENT ON FUNCTION public.propagate_merchant_business_name()
IS 'AFTER trigger: propagates a business_name change into the merchant''s page_configs (draft + published).';
