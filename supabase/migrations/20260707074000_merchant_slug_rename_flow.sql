-- =============================================================================
-- Sanctioned merchant slug (storefront URL) rename flow.
--
-- Slugs are immutable by default (20260517200500_lock_established_merchant_slugs.sql)
-- because they back public URLs, feeds, carts, and agent discovery. The one time a
-- slug WAS changed, it was a raw DB edit that bypassed the guard and left the
-- domain row, the baked config, and every old link inconsistent (the old
-- subdomain 404'd with no redirect).
--
-- This migration makes a URL change a single, safe, transactional operation
-- instead of something forbidden-and-therefore-hand-hacked:
--
--   * merchant_slug_aliases   — old_slug -> merchant_id, so the old URL can 301.
--   * prevent_established_merchant_slug_change() is amended to allow a slug change
--     ONLY within a transaction that set the `app.slug_rename_allowed` GUC — which
--     only rename_merchant_slug() does. A plain UPDATE is still rejected.
--   * rename_merchant_slug(merchant_id, new_slug) — validates (format + reserved +
--     uniqueness), checks ownership/staff permission, then atomically updates
--     merchants.slug, moves the primary subdomain row, and records the old slug as
--     an alias.
--
-- Display-name propagation is handled separately (see
-- 20260706120000_normalize_and_propagate_merchant_business_name.sql).
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Alias table: maps a retired slug to the merchant that owns it now.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merchant_slug_aliases (
  old_slug    text PRIMARY KEY,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_slug_aliases_merchant_id
  ON public.merchant_slug_aliases (merchant_id);

ALTER TABLE public.merchant_slug_aliases ENABLE ROW LEVEL SECURITY;

-- Alias resolution is public routing information (old URL -> which merchant),
-- read by the storefront redirect path. Writes happen only through the
-- SECURITY DEFINER rename RPC (owner), so there are deliberately no write policies.
DROP POLICY IF EXISTS "slug aliases are publicly readable" ON public.merchant_slug_aliases;
CREATE POLICY "slug aliases are publicly readable"
  ON public.merchant_slug_aliases FOR SELECT
  TO anon, authenticated
  USING (true);

-- Column-scoped grants (no table-wide SELECT); nothing here is sensitive but we
-- keep the pattern strict.
REVOKE ALL ON public.merchant_slug_aliases FROM anon, authenticated;
GRANT SELECT (old_slug, merchant_id) ON public.merchant_slug_aliases TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- Single source of truth for slugs that may NOT back a storefront URL: infra
-- subdomains + the storefront route words. It is enforced at EVERY slug-writing
-- boundary — generate_slug() SKIPS these when auto-generating, the alias-collision
-- trigger REJECTS them on insert/rename, and rename_merchant_slug() validates
-- against them — so a merchant can never be handed (by auto-generation, a direct
-- insert, or a rename) a slug that the proxy and merchant resolvers treat as a
-- platform route and would serve "Store Not Found" for.
-- MUST stay in sync with RESERVED_PATHS in apps/web/src/lib/validation.ts and
-- RESERVED_SUBDOMAINS in apps/web/src/proxy.ts.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_reserved_merchant_slug(p_slug text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'pg_catalog', 'public'
AS $$
  SELECT lower(btrim(COALESCE(p_slug, ''))) = ANY (ARRAY[
    -- infra subdomains
    'www','app','api','admin','dashboard','mail','smtp',
    'assets','static','cdn','status','support','help',
    -- storefront route words (RESERVED_PATHS)
    'cart','checkout','auth','login','logout','builder','onboarding','preview',
    'about','contact','blog','pricing','terms','privacy','faq','features','demo',
    'developers','track','invite','reset-password','template-preview','orders',
    'saved','addresses','reviews','wallet','repairs','swap','account',
    'delete-account','images','product','staff',
    -- platform (auth) route pages under apps/web/src/app/(auth)/
    'signup','forgot-password','update-password','verify'
  ]);
$$;

-- Pure predicate over a constant list (no data access): safe for every write
-- path's role to evaluate. generate_slug() and the collision trigger run as the
-- invoking user (authenticated onboarding), so they need EXECUTE.
GRANT EXECUTE ON FUNCTION public.is_reserved_merchant_slug(text)
  TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Amend the immutability guard: still blocks slug changes everywhere EXCEPT
-- inside a rename_merchant_slug() transaction (which sets the GUC below).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_established_merchant_slug_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  IF OLD.slug IS NOT NULL
     AND btrim(OLD.slug) <> ''
     AND NEW.slug IS DISTINCT FROM OLD.slug
     AND COALESCE(current_setting('app.slug_rename_allowed', true), 'off') <> 'on'
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'merchant_slug_immutable',
      DETAIL = 'Merchant slug cannot be changed after it is set.',
      HINT = 'Use rename_merchant_slug() (the "Change store URL" flow), not a direct UPDATE.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_established_merchant_slug_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_established_merchant_slug_change() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_established_merchant_slug_change() FROM authenticated;

-- ----------------------------------------------------------------------------
-- rename_merchant_slug: the ONLY sanctioned way to change a storefront URL.
-- SECURITY DEFINER so it can move the domain row and write the alias; it does
-- its own ownership/permission check against auth.uid().
-- ----------------------------------------------------------------------------
-- DROP first: this returns jsonb ({slug, retired_slug}); CREATE OR REPLACE cannot
-- change a function's return type in place, so a re-apply over an earlier text-
-- returning definition would error without the drop.
DROP FUNCTION IF EXISTS public.rename_merchant_slug(uuid, text);
CREATE OR REPLACE FUNCTION public.rename_merchant_slug(
  p_merchant_id uuid,
  p_new_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_uid            uuid := auth.uid();
  v_new            text := lower(btrim(COALESCE(p_new_slug, '')));
  v_old_slug       text;
  v_old_subdomain  text;
  -- Default only; overridden below from the merchant's actual subdomain row so
  -- this works under any configured NEXT_PUBLIC_ROOT_DOMAIN, not just usebaci.com.
  v_root           text := 'usebaci.com';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- Ownership / staff permission (mirrors the merchants UPDATE RLS policy).
  IF NOT EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.id = p_merchant_id
      AND (
        m.user_id = v_uid
        OR public.check_staff_permission(v_uid, m.id, 'settings', 'edit')
      )
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Format: same shape generate_slug() produces; 3..63 chars.
  IF v_new !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
     OR length(v_new) < 3 OR length(v_new) > 63
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_slug';
  END IF;

  -- Reserved words (infra subdomains + storefront route words) — authoritative
  -- backstop for any direct RPC caller; the route also rejects them up-front via
  -- renameSlugSchema for a friendly error. Single source of truth lives in
  -- is_reserved_merchant_slug() (also enforced by generate_slug + the collision trigger).
  IF public.is_reserved_merchant_slug(v_new) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'reserved_slug';
  END IF;

  -- FOR UPDATE serializes concurrent renames of the same merchant: two
  -- overlapping calls can't both read the same old slug and leave the domain
  -- row / alias bookkeeping inconsistent with the final merchants.slug.
  SELECT slug INTO v_old_slug FROM public.merchants WHERE id = p_merchant_id FOR UPDATE;
  IF v_old_slug IS NULL OR btrim(v_old_slug) = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'no_current_slug';
  END IF;

  IF v_new = v_old_slug THEN
    -- no-op: nothing was retired, so the caller has no extra slug to invalidate.
    RETURN jsonb_build_object('slug', v_new, 'retired_slug', NULL);
  END IF;

  -- Serialize with concurrent slug writes on the SAME slug — other renames AND direct
  -- INSERTs (mobile onboarding / imports), whose prevent_merchant_slug_alias_collision
  -- trigger takes these same locks. Without this, a rename freeing `old` and a
  -- concurrent INSERT of `old` can BOTH commit: the insert's BEFORE trigger reads the
  -- alias table before this rename records `old`, then its unique-slug check blocks on
  -- this rename's row update and proceeds after `old` is freed — leaving `old` both a
  -- live store and a retired alias. Transaction-scoped advisory locks keyed on the
  -- retired (v_old_slug) and target (v_new) slugs, acquired in hash-sorted order so two
  -- slug-swapping renames can't deadlock, close that window.
  IF hashtext(v_old_slug) <= hashtext(v_new) THEN
    PERFORM pg_advisory_xact_lock(hashtext('merchant_slug'), hashtext(v_old_slug));
    IF hashtext(v_new) <> hashtext(v_old_slug) THEN
      PERFORM pg_advisory_xact_lock(hashtext('merchant_slug'), hashtext(v_new));
    END IF;
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext('merchant_slug'), hashtext(v_new));
    PERFORM pg_advisory_xact_lock(hashtext('merchant_slug'), hashtext(v_old_slug));
  END IF;

  -- Derive the ACTUAL storefront root domain from the merchant's existing
  -- subdomain row. Onboarding creates {slug}.<NEXT_PUBLIC_ROOT_DOMAIN>, which is
  -- not always usebaci.com; hardcoding it would leave the real subdomain row at
  -- the old slug (and fire no domains change to resync Edge Config), breaking the
  -- renamed store's URL in those environments. Reading the stored row also moves
  -- the correct row even if its label had drifted from merchants.slug. Falls back
  -- to the usebaci.com default when there is no subdomain row to read.
  SELECT domain INTO v_old_subdomain
  FROM public.domains
  WHERE merchant_id = p_merchant_id AND domain_type = 'subdomain'
  ORDER BY is_primary DESC
  LIMIT 1;
  IF v_old_subdomain IS NOT NULL AND strpos(v_old_subdomain, '.') > 0 THEN
    v_root := substr(v_old_subdomain, strpos(v_old_subdomain, '.') + 1);
  END IF;

  -- Uniqueness: not another merchant's live slug, alias, or subdomain.
  IF EXISTS (SELECT 1 FROM public.merchants WHERE slug = v_new AND id <> p_merchant_id) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'slug_taken';
  END IF;
  IF EXISTS (SELECT 1 FROM public.merchant_slug_aliases WHERE old_slug = v_new AND merchant_id <> p_merchant_id) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'slug_taken';
  END IF;
  IF EXISTS (SELECT 1 FROM public.domains WHERE domain = v_new || '.' || v_root AND merchant_id <> p_merchant_id) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'slug_taken';
  END IF;

  -- Permit the immutability trigger for THIS transaction only.
  PERFORM set_config('app.slug_rename_allowed', 'on', true);

  BEGIN
    UPDATE public.merchants SET slug = v_new WHERE id = p_merchant_id;

    -- Move the storefront subdomain record to match the new slug. Match by
    -- domain_type (NOT is_primary): for a merchant whose CUSTOM domain is primary,
    -- the {oldSlug}.<root> row is is_primary = false, so an is_primary filter would
    -- match zero rows — leaving the subdomain stale AND firing no domains-table
    -- change to resync Edge Config, which would break the custom-domain storefront.
    -- Match the EXACT stored subdomain row read above (v_old_subdomain) so the move
    -- is correct even under a non-usebaci.com root or a drifted label. The route
    -- also explicitly triggers the Edge Config resync as a backstop.
    UPDATE public.domains
    SET domain = v_new || '.' || v_root
    WHERE merchant_id = p_merchant_id
      AND domain_type = 'subdomain'
      AND domain = COALESCE(v_old_subdomain, v_old_slug || '.' || v_root);

    -- Record the retired slug so its old URL 301s. If the new slug was itself a
    -- retired alias (renaming back), reclaim it.
    DELETE FROM public.merchant_slug_aliases WHERE old_slug = v_new;
    INSERT INTO public.merchant_slug_aliases (old_slug, merchant_id)
    VALUES (v_old_slug, p_merchant_id)
    ON CONFLICT (old_slug) DO UPDATE
      SET merchant_id = EXCLUDED.merchant_id, created_at = now();
  EXCEPTION WHEN unique_violation THEN
    -- The FOR UPDATE lock only serializes the SAME merchant. Two DIFFERENT
    -- merchants can both pass the EXISTS uniqueness checks above and then race on
    -- the merchants/domains unique index here. Surface the loser as slug_taken
    -- (409) rather than letting a raw unique_violation fall through to a 500.
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'slug_taken';
  END;

  -- Close the bypass immediately so it can never leak to a later statement in
  -- the same transaction (PostgREST already scopes it per-RPC, this is belt-and-suspenders).
  PERFORM set_config('app.slug_rename_allowed', 'off', true);

  -- Return the slug that was ACTUALLY retired (read under FOR UPDATE), not the
  -- caller's pre-RPC read: overlapping renames (A->B then A->C) both read 'A' but
  -- the second call really retires 'B', so the caller must invalidate 'B' to avoid
  -- a stale cache for the intermediate public URL.
  RETURN jsonb_build_object('slug', v_new, 'retired_slug', v_old_slug);
END;
$$;

-- Only signed-in merchants may call it; the function authorizes internally.
REVOKE ALL ON FUNCTION public.rename_merchant_slug(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rename_merchant_slug(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rename_merchant_slug(uuid, text) TO authenticated;

COMMENT ON TABLE public.merchant_slug_aliases
IS 'Retired storefront slugs (old_slug -> merchant_id) so a renamed store''s old URL 301s to the current one.';
COMMENT ON FUNCTION public.rename_merchant_slug(uuid, text)
IS 'Sanctioned storefront-URL rename: validates + authorizes, updates merchants.slug, moves the primary subdomain row, and records the old slug as an alias. The only path allowed past the slug immutability trigger.';

-- ----------------------------------------------------------------------------
-- Make generate_slug() alias- AND reserved-aware. Onboarding (apps/web/.../onboarding/
-- actions.ts and api/mobile-onboarding) assigns new-merchant slugs via generate_slug(),
-- which previously only avoided collisions with live merchants.slug. It now also
-- skips reserved words (is_reserved_merchant_slug) so a business named e.g. "Wallet"
-- or "Staff" is auto-assigned 'wallet-1'/'staff-1' instead of an unresolvable
-- reserved slug. Without also skipping merchant_slug_aliases, a brand-new store
-- could be handed a slug that is someone's RETIRED alias — and the retired-slug
-- redirect would then 301 the new store's own URL away to the merchant that
-- retired it. rename_merchant_slug
-- already rejects aliased targets; this closes the same gap for creation.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_slug(text_input text)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    base_slug := lower(regexp_replace(text_input, '[^a-zA-Z0-9\s-]', '', 'g'));
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');
    base_slug := trim(both '-' from base_slug);

    IF base_slug = '' THEN
        base_slug := 'store';
    END IF;

    -- DNS labels (and the subdomain validators / VALID_SLUG_REGEX) cap at 63 chars.
    -- Cap the base and reserve room for any '-N' de-dup suffix so the auto-generated
    -- slug is always a routable <slug>.<root> subdomain. rtrim avoids leaving a
    -- trailing hyphen exposed by the cut (which would also fail the slug regex).
    base_slug := rtrim(left(base_slug, 63), '-');
    IF base_slug = '' THEN
        base_slug := 'store';
    END IF;

    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM public.merchants WHERE slug = final_slug)
       OR EXISTS (SELECT 1 FROM public.merchant_slug_aliases WHERE old_slug = final_slug)
       OR public.is_reserved_merchant_slug(final_slug) LOOP
        counter := counter + 1;
        final_slug :=
            rtrim(left(base_slug, 63 - length('-' || counter::text)), '-')
            || '-' || counter;
    END LOOP;

    RETURN final_slug;
END;
$function$;

-- ----------------------------------------------------------------------------
-- DB-boundary guard: no merchant may CLAIM another merchant's retired alias.
-- generate_slug() is alias-aware, but that only covers slugs it generates. Other
-- paths write merchants.slug directly — mobile onboarding writes a caller-provided
-- slug (apps/web/src/app/api/mobile-onboarding/route.ts), admin edits, imports —
-- and could hand a brand-new store a slug that is someone else's retired alias.
-- The retired-slug redirect would then stop 301ing the original merchant's old
-- URL and instead serve the new store. This trigger closes that TOCTOU window for
-- EVERY write path, not just generate_slug().
--
-- ERRCODE 23505 (unique_violation) on purpose: rename_merchant_slug()'s own
-- `EXCEPTION WHEN unique_violation` block re-raises it as slug_taken (-> 409), and
-- onboarding's slug-collision handling treats it as "that URL is taken" rather
-- than a 500. A merchant reclaiming its OWN alias (rename-back) is allowed:
-- merchant_id <> NEW.id excludes it, and rename_merchant_slug deletes the alias
-- row for the reclaimed slug before the UPDATE anyway.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_merchant_slug_alias_collision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_norm text := lower(btrim(COALESCE(NEW.slug, '')));
BEGIN
  -- Normalize the stored slug to the lowercase/trimmed form the proxy and merchant
  -- resolvers assume (hosts + app slug handling are already lowercased). This stops a
  -- direct write path (imports, admin, raw SQL) from persisting an unroutable case/
  -- whitespace variant AND from bypassing the checks below with one — e.g. `OldSlug`
  -- or ` oldslug ` must still collide with an existing `oldslug` alias. Skip a NULL or
  -- blank slug: pending/incomplete signups and invited users rely on the unique index
  -- allowing many NULLs (only ONE empty string), so a NULL must stay NULL, never ''.
  IF NEW.slug IS NOT NULL AND v_norm <> '' AND NEW.slug IS DISTINCT FROM v_norm THEN
    NEW.slug := v_norm;
  END IF;

  IF v_norm <> ''
     AND (TG_OP = 'INSERT' OR NEW.slug IS DISTINCT FROM OLD.slug)
  THEN
    -- Serialize with a concurrent rename_merchant_slug() that frees/records this slug
    -- as an alias: take the SAME transaction-scoped advisory lock (keyed on the slug)
    -- BEFORE the alias check below, so this write can't read a stale alias table and
    -- then claim a slug the rename is retiring. (rename acquires this lock for both the
    -- retired and target slugs.)
    PERFORM pg_advisory_xact_lock(hashtext('merchant_slug'), hashtext(v_norm));

    -- (a) Too long for a DNS label / the subdomain validators (63 chars). A direct
    -- insert of a longer slug (mobile onboarding's first-word-derived value, admin,
    -- imports) would provision an unroutable <slug>.<root> subdomain. generate_slug()
    -- already caps auto slugs; this closes the direct-write path. 23505 (see below)
    -- → mobile onboarding retries an AUTO slug via the capped generate_slug().
    IF length(v_norm) > 63 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'slug_too_long',
        DETAIL = 'This storefront URL exceeds the 63-character subdomain limit.',
        HINT = 'Choose a shorter storefront URL.';
    END IF;

    -- (b) Reserved word (infra subdomain or storefront route). A merchant handed
    -- one of these via direct insert (mobile onboarding's caller-provided slug,
    -- admin edits, imports) would be unresolvable — the proxy and merchant
    -- resolvers treat it as a platform route and serve "Store Not Found". Reject
    -- at the DB boundary so no write path can create that broken state. Guarded by
    -- INSERT-or-slug-change so a pre-existing reserved-slug merchant (grandfathered
    -- before the word was reserved) can still be updated as long as its slug is
    -- unchanged. 23505 (see below) → mobile onboarding retries an AUTO slug via the
    -- reserved-aware generate_slug() and 409s an EXPLICIT one.
    IF public.is_reserved_merchant_slug(v_norm) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'slug_is_reserved',
        DETAIL = 'This storefront URL is reserved by the platform and cannot be used.',
        HINT = 'Choose a different storefront URL.';
    END IF;

    -- (c) Another merchant's retired alias.
    IF EXISTS (
      SELECT 1 FROM public.merchant_slug_aliases a
      WHERE a.old_slug = v_norm AND a.merchant_id <> NEW.id
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'slug_is_retired_alias',
        DETAIL = 'This storefront URL was retired by another merchant and cannot be reused.',
        HINT = 'Choose a different storefront URL.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_merchant_slug_alias_collision() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_merchant_slug_alias_collision() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_merchant_slug_alias_collision() FROM authenticated;

-- Fires only when slug is written (INSERT or UPDATE OF slug) so unrelated
-- merchant updates pay nothing. Named to sort BEFORE zz_prevent_established_
-- merchant_slug_change so the alias check runs first (both are benign either way).
-- Fires on slug OR business_name updates: the set_merchant_slug trigger fills
-- NEW.slug from the business name for an incomplete merchant (null/empty slug),
-- so a business_name-only UPDATE can still SET the slug — and must be guarded too.
-- (set_merchant_slug sorts before trg_ so NEW.slug is already populated here.)
DROP TRIGGER IF EXISTS trg_prevent_merchant_slug_alias_collision ON public.merchants;
CREATE TRIGGER trg_prevent_merchant_slug_alias_collision
  BEFORE INSERT OR UPDATE OF slug, business_name ON public.merchants
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_merchant_slug_alias_collision();

COMMENT ON FUNCTION public.prevent_merchant_slug_alias_collision()
IS 'Rejects (23505) any INSERT/UPDATE that sets merchants.slug to a slug retired by a DIFFERENT merchant, so a new store cannot hijack another merchant''s old URL. A merchant reclaiming its own alias is allowed.';

-- ----------------------------------------------------------------------------
-- One-time backfill: rename any EXISTING merchant whose slug is now reserved.
-- This migration newly reserves words (e.g. 'staff', 'signup') that were valid
-- slugs before — and RESERVED_PATHS also makes isValidMerchantIdentifier() reject
-- them at resolution, so such a merchant would otherwise render "Store Not Found"
-- while only future writes are blocked. Migrate each to a safe generated slug and
-- record the old one as an alias so its old URL 301s to the new one. Verified zero
-- such rows in prod at write time; this is an idempotent safety net for any straggler
-- created before this deploys (creation is only blocked once the trigger above exists).
-- ----------------------------------------------------------------------------
DO $backfill$
DECLARE
  r        record;
  v_safe   text;
BEGIN
  -- Permit the immutability guard for this backfill only.
  PERFORM set_config('app.slug_rename_allowed', 'on', true);
  FOR r IN
    SELECT id, slug FROM public.merchants
    WHERE public.is_reserved_merchant_slug(slug)
  LOOP
    v_safe := public.generate_slug(r.slug || '-store');
    -- Move the merchant's subdomain row to the safe label, preserving its root
    -- domain (works for any NEXT_PUBLIC_ROOT_DOMAIN, not just usebaci.com).
    UPDATE public.domains d
    SET domain = v_safe || substr(d.domain, position('.' in d.domain))
    WHERE d.merchant_id = r.id
      AND d.domain_type = 'subdomain'
      AND position('.' in d.domain) > 0
      AND left(d.domain, position('.' in d.domain) - 1) = r.slug;
    UPDATE public.merchants SET slug = v_safe WHERE id = r.id;
    -- Record the retired reserved slug as this merchant's alias (its old URL 301s).
    INSERT INTO public.merchant_slug_aliases (old_slug, merchant_id)
    VALUES (r.slug, r.id)
    ON CONFLICT (old_slug) DO NOTHING;
    RAISE NOTICE 'Backfilled reserved slug % -> % (merchant %)', r.slug, v_safe, r.id;
  END LOOP;
  PERFORM set_config('app.slug_rename_allowed', 'off', true);
END
$backfill$;
