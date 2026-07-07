-- =============================================
-- REGRESSION TEST: merchant slug rename flow
--   Validates 20260707074000_merchant_slug_rename_flow.sql
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/merchant_slug_rename.sql
--   (or via Supabase MCP execute_sql). Mutates inside a transaction and ROLLBACKs.
--
-- Proves:
--   1. A direct UPDATE of an established slug is still blocked (immutability holds).
--   2. rename_merchant_slug() rejects invalid, reserved, and taken slugs.
--   3. The happy path updates merchants.slug, moves the primary subdomain row,
--      and records the old slug as an alias — inside one transaction.
--   4. A non-owner cannot rename another merchant's slug.
--   5. Trigger helpers/RPC grant no EXECUTE to anon/PUBLIC (RPC is authenticated-only).
--   6. A custom-domain-primary merchant's NON-primary subdomain row is still moved.
--   7. generate_slug() will not hand out a retired alias.
--   8. The DB-boundary trigger blocks a direct INSERT that claims a foreign alias,
--      yet still allows a merchant to reclaim its OWN alias (rename-back), and
--      rejects renaming to another merchant's alias as slug_taken.
-- =============================================

BEGIN;

DO $test$
DECLARE
  v_owner uuid := '8f0ed783-0000-4000-8000-000000000501';
  v_mid   uuid := '8f0ed783-0000-4000-8000-000000000502';
  v_other uuid := '8f0ed783-0000-4000-8000-000000000503';
  v_cust_owner uuid := '8f0ed783-0000-4000-8000-000000000504';
  v_cust_mid uuid := '8f0ed783-0000-4000-8000-000000000505';
  v_claim uuid := '8f0ed783-0000-4000-8000-000000000506';
  v_ret text; v_slug text; v_dom text; v_alias int; v_blocked boolean := false;
  insecure text;
BEGIN
  -- ---------- object existence + grants ----------
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.rename_merchant_slug(uuid,text)'::regprocedure) THEN
    RAISE EXCEPTION 'rename_merchant_slug() missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='merchant_slug_aliases') THEN
    RAISE EXCEPTION 'merchant_slug_aliases table missing';
  END IF;
  -- Every role is implicitly a member of PUBLIC, so anon EXECUTE = false proves
  -- neither anon nor the PUBLIC pseudo-role can call it. (has_function_privilege
  -- does not accept 'PUBLIC' as a role name — it raises "role does not exist".)
  IF has_function_privilege('anon', 'public.rename_merchant_slug(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'rename_merchant_slug must not be executable by anon/PUBLIC';
  END IF;

  -- ---------- fixtures ----------
  INSERT INTO auth.users (id) VALUES (v_owner);
  INSERT INTO public.merchants (id, user_id, email, business_name, slug)
  VALUES (v_mid, v_owner, 'rename@example.com', 'Rename Store', 'oldslug');
  INSERT INTO public.domains (merchant_id, domain, tld, domain_type, status, is_primary)
  VALUES (v_mid, 'oldslug.usebaci.com', '.usebaci.com', 'subdomain', 'active', true);
  -- v_other owns its OWN merchant (user_id = v_other): it is a non-owner of v_mid
  -- (assertion 4) yet a legitimate owner able to rename its own store (assertion 9).
  INSERT INTO auth.users (id) VALUES (v_other);
  INSERT INTO public.merchants (id, user_id, email, business_name, slug)
  VALUES (v_other, v_other, 'other@example.com', 'Other Store', 'takenslug');

  -- Simulate the authenticated caller (auth.uid()).
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner)::text, true);

  -- 1. direct UPDATE still blocked
  BEGIN
    UPDATE public.merchants SET slug = 'hackslug' WHERE id = v_mid;
  EXCEPTION WHEN check_violation THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'immutability guard did not block a direct UPDATE'; END IF;

  -- 2. validation rejections
  BEGIN v_ret := public.rename_merchant_slug(v_mid, 'Ab');        RAISE EXCEPTION 'invalid slug accepted';  EXCEPTION WHEN sqlstate '22023' THEN NULL; END;
  BEGIN v_ret := public.rename_merchant_slug(v_mid, 'admin');     RAISE EXCEPTION 'reserved slug accepted'; EXCEPTION WHEN sqlstate '22023' THEN NULL; END;
  BEGIN v_ret := public.rename_merchant_slug(v_mid, 'takenslug'); RAISE EXCEPTION 'taken slug accepted';    EXCEPTION WHEN sqlstate '23505' THEN NULL; END;

  -- 3. happy path
  v_ret := (public.rename_merchant_slug(v_mid, 'newslug'))->>'slug';
  IF v_ret <> 'newslug' THEN RAISE EXCEPTION 'rename returned "%"', v_ret; END IF;

  SELECT slug INTO v_slug FROM public.merchants WHERE id = v_mid;
  SELECT domain INTO v_dom FROM public.domains WHERE merchant_id = v_mid AND is_primary;
  SELECT count(*) INTO v_alias FROM public.merchant_slug_aliases WHERE old_slug = 'oldslug' AND merchant_id = v_mid;
  IF v_slug <> 'newslug' THEN RAISE EXCEPTION 'slug not updated: "%"', v_slug; END IF;
  IF v_dom <> 'newslug.usebaci.com' THEN RAISE EXCEPTION 'primary subdomain not moved: "%"', v_dom; END IF;
  IF v_alias <> 1 THEN RAISE EXCEPTION 'old slug not recorded as alias'; END IF;

  -- 4. non-owner cannot rename
  PERFORM set_config('request.jwt.claim.sub', v_other::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other)::text, true);
  BEGIN
    v_ret := public.rename_merchant_slug(v_mid, 'sneaky');
    RAISE EXCEPTION 'non-owner rename was allowed';
  EXCEPTION WHEN sqlstate '42501' THEN NULL;
  END;

  -- 5. custom-domain-primary rename (regression for the round-3 fix): the
  -- {slug}.usebaci.com row is NON-primary (the custom domain is primary), so the
  -- domain move must match by domain_type, not is_primary. The subdomain row must
  -- still move; the custom domain must be left untouched.
  INSERT INTO auth.users (id) VALUES (v_cust_owner);
  INSERT INTO public.merchants (id, user_id, email, business_name, slug)
  VALUES (v_cust_mid, v_cust_owner, 'cust@example.com', 'Custom Store', 'custslug');
  INSERT INTO public.domains (merchant_id, domain, tld, domain_type, status, is_primary)
  VALUES (v_cust_mid, 'custom-store.example', '.example', 'custom', 'active', true);
  INSERT INTO public.domains (merchant_id, domain, tld, domain_type, status, is_primary)
  VALUES (v_cust_mid, 'custslug.usebaci.com', '.usebaci.com', 'subdomain', 'active', false);

  PERFORM set_config('request.jwt.claim.sub', v_cust_owner::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cust_owner)::text, true);
  v_ret := (public.rename_merchant_slug(v_cust_mid, 'custnew'))->>'slug';

  SELECT domain INTO v_dom FROM public.domains
  WHERE merchant_id = v_cust_mid AND domain_type = 'subdomain';
  IF v_dom <> 'custnew.usebaci.com' THEN
    RAISE EXCEPTION 'custom-domain merchant: non-primary subdomain not moved: "%"', v_dom;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.domains
    WHERE merchant_id = v_cust_mid AND domain = 'custom-store.example' AND is_primary
  ) THEN
    RAISE EXCEPTION 'custom-domain merchant: custom domain got clobbered';
  END IF;

  -- 6. generate_slug() is alias-aware: 'custslug' is now a retired alias (renamed
  -- to 'custnew' above), so a new merchant must NOT be handed that exact slug.
  IF public.generate_slug('custslug') = 'custslug' THEN
    RAISE EXCEPTION 'generate_slug reused a retired alias';
  END IF;

  -- 7. The DB-boundary trigger blocks a DIRECT INSERT that claims ANOTHER
  -- merchant's retired alias ('oldslug' is v_mid's alias). This is the vector
  -- that generate_slug() can't cover (mobile onboarding writes slug directly).
  BEGIN
    INSERT INTO public.merchants (id, email, business_name, slug)
    VALUES (v_claim, 'claim@example.com', 'Claim Store', 'oldslug');
    RAISE EXCEPTION 'a direct INSERT claimed a retired alias';
  EXCEPTION WHEN unique_violation THEN NULL; -- sqlstate 23505
  END;

  -- 8. Rename-BACK must still work THROUGH the new trigger (a merchant reclaiming
  -- its OWN alias is allowed). v_mid: newslug -> oldslug. The 'oldslug' alias is
  -- reclaimed (deleted) and 'newslug' becomes the new alias.
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner)::text, true);
  v_ret := (public.rename_merchant_slug(v_mid, 'oldslug'))->>'slug';
  IF v_ret <> 'oldslug' THEN RAISE EXCEPTION 'rename-back returned "%"', v_ret; END IF;
  SELECT slug INTO v_slug FROM public.merchants WHERE id = v_mid;
  IF v_slug <> 'oldslug' THEN RAISE EXCEPTION 'rename-back did not restore slug: "%"', v_slug; END IF;
  SELECT count(*) INTO v_alias FROM public.merchant_slug_aliases WHERE old_slug = 'oldslug';
  IF v_alias <> 0 THEN RAISE EXCEPTION 'rename-back did not reclaim the old alias'; END IF;
  SELECT count(*) INTO v_alias FROM public.merchant_slug_aliases WHERE old_slug = 'newslug' AND merchant_id = v_mid;
  IF v_alias <> 1 THEN RAISE EXCEPTION 'rename-back did not record newslug as an alias'; END IF;

  -- 9. Renaming to ANOTHER merchant's retired alias is rejected as slug_taken.
  -- 'newslug' is now v_mid's alias (from the rename-back above); v_other must not
  -- be able to claim it via the rename RPC.
  PERFORM set_config('request.jwt.claim.sub', v_other::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other)::text, true);
  BEGIN
    v_ret := public.rename_merchant_slug(v_other, 'newslug');
    RAISE EXCEPTION 'rename to a foreign alias was allowed';
  EXCEPTION WHEN sqlstate '23505' THEN NULL;
  END;

  -- 10. is_reserved_merchant_slug(): reserved words true (normalized), normal false.
  IF NOT public.is_reserved_merchant_slug('staff')
     OR NOT public.is_reserved_merchant_slug('  WALLET ')
     OR public.is_reserved_merchant_slug('oldslug') THEN
    RAISE EXCEPTION 'is_reserved_merchant_slug misclassified a slug';
  END IF;

  -- 11. generate_slug() skips reserved words: a business named "Staff" must not be
  -- auto-assigned the reserved 'staff' slug (the proxy/resolvers would 404 it).
  v_slug := public.generate_slug('Staff');
  IF v_slug = 'staff' OR public.is_reserved_merchant_slug(v_slug) THEN
    RAISE EXCEPTION 'generate_slug handed out a reserved slug: "%"', v_slug;
  END IF;

  -- 12. The DB-boundary trigger blocks a DIRECT INSERT of a reserved slug (mobile
  -- onboarding's caller-provided slug / admin / imports could otherwise create an
  -- unresolvable store). Raised as 23505 so mobile onboarding's collision handling
  -- retries an AUTO slug and 409s an EXPLICIT one.
  v_blocked := false;
  BEGIN
    INSERT INTO public.merchants (id, email, business_name, slug)
    VALUES ('8f0ed783-0000-4000-8000-000000000507', 'reserved@example.com', 'Reserved Store', 'wallet');
    RAISE EXCEPTION 'a direct INSERT created a reserved slug';
  EXCEPTION WHEN unique_violation THEN v_blocked := true; -- sqlstate 23505
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'reserved-slug INSERT was not blocked'; END IF;

  -- 13. Root-domain agnostic: a merchant whose subdomain lives under a NON-usebaci.com
  -- root (a self-hosted NEXT_PUBLIC_ROOT_DOMAIN) must have its subdomain row moved to
  -- the new slug under that SAME root — not silently left stale or forced onto usebaci.com.
  INSERT INTO auth.users (id) VALUES ('8f0ed783-0000-4000-8000-000000000508');
  INSERT INTO public.merchants (id, user_id, email, business_name, slug)
  VALUES ('8f0ed783-0000-4000-8000-000000000509', '8f0ed783-0000-4000-8000-000000000508',
          'root@example.com', 'Root Store', 'rootslug');
  INSERT INTO public.domains (merchant_id, domain, tld, domain_type, status, is_primary)
  VALUES ('8f0ed783-0000-4000-8000-000000000509', 'rootslug.shop.example',
          '.shop.example', 'subdomain', 'active', true);
  PERFORM set_config('request.jwt.claim.sub', '8f0ed783-0000-4000-8000-000000000508', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', '8f0ed783-0000-4000-8000-000000000508')::text, true);
  v_ret := (public.rename_merchant_slug('8f0ed783-0000-4000-8000-000000000509', 'rootnew'))->>'slug';
  SELECT domain INTO v_dom FROM public.domains
    WHERE merchant_id = '8f0ed783-0000-4000-8000-000000000509' AND domain_type = 'subdomain';
  IF v_dom <> 'rootnew.shop.example' THEN
    RAISE EXCEPTION 'non-usebaci root: subdomain not moved under the configured root: "%"', v_dom;
  END IF;

  -- 14. generate_slug caps at the 63-char DNS/subdomain limit even when a de-dup
  -- suffix is appended, so the provisioned <slug>.<root> subdomain stays routable.
  -- Seed a merchant AT the 63-char cap so the 80-char input collides and the loop
  -- must append a suffix WITHIN the limit.
  INSERT INTO auth.users (id) VALUES ('8f0ed783-0000-4000-8000-000000000510');
  INSERT INTO public.merchants (id, user_id, email, business_name, slug)
  VALUES ('8f0ed783-0000-4000-8000-000000000511', '8f0ed783-0000-4000-8000-000000000510',
          'long@example.com', 'Long Store', left(repeat('a', 80), 63));
  v_slug := public.generate_slug(repeat('a', 80));
  IF length(v_slug) > 63 THEN
    RAISE EXCEPTION 'generate_slug exceeded 63 chars: "%" (len %)', v_slug, length(v_slug);
  END IF;
  IF v_slug = left(repeat('a', 80), 63) THEN
    RAISE EXCEPTION 'generate_slug returned a colliding slug';
  END IF;

  -- 15. The DB-boundary trigger blocks a DIRECT INSERT of a slug longer than the
  -- 63-char subdomain limit (mobile first-word-derived / admin / import paths that
  -- bypass generate_slug), raised as 23505 so mobile onboarding retries the AUTO slug.
  v_blocked := false;
  BEGIN
    INSERT INTO public.merchants (id, email, business_name, slug)
    VALUES ('8f0ed783-0000-4000-8000-000000000512', 'toolong@example.com', 'Too Long', repeat('b', 64));
    RAISE EXCEPTION 'an over-length slug INSERT was not blocked';
  EXCEPTION WHEN unique_violation THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'over-length slug INSERT was not blocked'; END IF;

  -- 16. Case/whitespace normalization at the DB boundary: a MIXED-CASE variant of
  -- another merchant's retired alias is still blocked (trigger normalizes NEW.slug
  -- before the alias check), and a padded slug is stored trimmed + lowercased.
  INSERT INTO auth.users (id) VALUES ('8f0ed783-0000-4000-8000-000000000513');
  INSERT INTO public.merchants (id, user_id, email, business_name, slug)
  VALUES ('8f0ed783-0000-4000-8000-000000000514', '8f0ed783-0000-4000-8000-000000000513',
          'norm@example.com', 'Norm Store', 'normlive');
  INSERT INTO public.merchant_slug_aliases (old_slug, merchant_id)
  VALUES ('normretired', '8f0ed783-0000-4000-8000-000000000514');
  v_blocked := false;
  BEGIN
    INSERT INTO public.merchants (id, email, business_name, slug)
    VALUES ('8f0ed783-0000-4000-8000-000000000515', 'nc@example.com', 'NC', 'NormRetired');
    RAISE EXCEPTION 'mixed-case alias variant was not blocked';
  EXCEPTION WHEN unique_violation THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'mixed-case alias collision missed'; END IF;
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES ('8f0ed783-0000-4000-8000-000000000516', 'nw@example.com', 'NW', '  Padded-Slug  ');
  SELECT slug INTO v_slug FROM public.merchants WHERE id = '8f0ed783-0000-4000-8000-000000000516';
  IF v_slug <> 'padded-slug' THEN RAISE EXCEPTION 'slug not normalized on write: "%"', v_slug; END IF;

  RAISE NOTICE 'merchant_slug_rename: ALL ASSERTIONS PASSED';
END;
$test$;

ROLLBACK;
