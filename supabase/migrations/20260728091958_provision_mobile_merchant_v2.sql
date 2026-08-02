-- Atomically provisions the authenticated mobile caller's merchant, platform
-- domain, and owner staff row. Identity, payout currency, root domain, role,
-- publication state, and merchant id are derived inside this trust boundary.
CREATE OR REPLACE FUNCTION public.provision_mobile_merchant_v2(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_business_name text,
  p_business_type text,
  p_other_business_type text,
  p_country text,
  p_slug text,
  p_slug_is_custom boolean,
  p_logo_url text,
  p_brand_colors jsonb,
  p_signup_source text
)
RETURNS TABLE (
  merchant_id uuid,
  merchant_slug text,
  created boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text := pg_catalog.lower(
    pg_catalog.btrim(COALESCE(auth.jwt() ->> 'email', ''))
  );
  v_first_name text := pg_catalog.btrim(COALESCE(p_first_name, ''));
  v_last_name text := pg_catalog.btrim(COALESCE(p_last_name, ''));
  v_full_name text;
  v_phone text := NULLIF(pg_catalog.btrim(COALESCE(p_phone, '')), '');
  v_logo_url text :=
    NULLIF(pg_catalog.btrim(COALESCE(p_logo_url, '')), '');
  v_business_name text := pg_catalog.btrim(
    pg_catalog.regexp_replace(COALESCE(p_business_name, ''), '\s+', ' ', 'g')
  );
  v_business_type text := pg_catalog.btrim(COALESCE(p_business_type, ''));
  v_other_business_type text :=
    NULLIF(pg_catalog.btrim(COALESCE(p_other_business_type, '')), '');
  v_final_business_type text;
  v_country text := pg_catalog.upper(pg_catalog.btrim(COALESCE(p_country, '')));
  v_payout_currency text;
  v_requested_slug text := NULLIF(pg_catalog.btrim(COALESCE(p_slug, '')), '');
  v_slug_seed text;
  v_slug_base text;
  v_candidate_slug text;
  v_merchant_id uuid;
  v_merchant_slug text;
  v_created boolean := false;
  v_provisioned boolean := false;
  v_slug_locked boolean := false;
  v_slug_attempt integer := 0;
  v_max_slug_attempts CONSTANT integer := 20;
  v_root_domain CONSTANT text := 'usebaci.com';
  v_platform_domain text;
  v_has_primary boolean;
  v_domain_id uuid;
  v_domain_is_primary boolean;
  v_constraint_name text;
  v_message_text text;
  v_primary_color text;
  v_background_color text;
  v_accent_color text;
  v_staff_id uuid;
  v_staff_user_id uuid;
  v_staff_status text;
  v_staff_attempt integer := 0;
BEGIN
  IF v_user_id IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'identity_incomplete'
      USING ERRCODE = 'PT422';
  END IF;

  IF p_signup_source NOT IN ('ios', 'android') THEN
    RAISE EXCEPTION 'invalid_signup_source'
      USING ERRCODE = 'PT400';
  END IF;

  IF NOT (char_length(v_first_name) BETWEEN 1 AND 100)
     OR NOT (char_length(v_last_name) BETWEEN 1 AND 100)
     OR NOT (char_length(v_business_name) BETWEEN 2 AND 200)
     OR NOT (char_length(v_business_type) BETWEEN 1 AND 100)
     OR (v_phone IS NOT NULL AND char_length(v_phone) > 32)
     OR (v_logo_url IS NOT NULL AND char_length(v_logo_url) > 2048)
  THEN
    RAISE EXCEPTION 'invalid_profile_input'
      USING ERRCODE = 'PT400';
  END IF;

  IF v_business_type = 'other' THEN
    IF v_other_business_type IS NULL
       OR NOT (char_length(v_other_business_type) BETWEEN 2 AND 100)
    THEN
      RAISE EXCEPTION 'invalid_other_business_type'
        USING ERRCODE = 'PT400';
    END IF;
    v_final_business_type := v_other_business_type;
  ELSE
    v_final_business_type := v_business_type;
  END IF;

  -- merchant-country-currency-map:start
  v_payout_currency := CASE v_country
    WHEN 'US' THEN 'USD'
    WHEN 'NG' THEN 'NGN'
    WHEN 'GB' THEN 'GBP'
    WHEN 'CA' THEN 'CAD'
    WHEN 'AU' THEN 'AUD'
    WHEN 'DE' THEN 'EUR'
    WHEN 'FR' THEN 'EUR'
    WHEN 'JP' THEN 'JPY'
    WHEN 'IN' THEN 'INR'
    WHEN 'BR' THEN 'BRL'
    WHEN 'ZA' THEN 'ZAR'
    WHEN 'AE' THEN 'AED'
    WHEN 'KE' THEN 'KES'
    WHEN 'GH' THEN 'GHS'
    WHEN 'EG' THEN 'EGP'
    WHEN 'CM' THEN 'XAF'
    WHEN 'CI' THEN 'XOF'
    WHEN 'SN' THEN 'XOF'
    WHEN 'BF' THEN 'XOF'
    WHEN 'RW' THEN 'RWF'
    WHEN 'TZ' THEN 'TZS'
    WHEN 'UG' THEN 'UGX'
    ELSE NULL
  END;
  -- merchant-country-currency-map:end

  IF v_payout_currency IS NULL THEN
    RAISE EXCEPTION 'unsupported_country'
      USING ERRCODE = 'PT400';
  END IF;

  IF p_brand_colors IS NOT NULL THEN
    IF pg_catalog.jsonb_typeof(p_brand_colors) <> 'object' THEN
      RAISE EXCEPTION 'invalid_brand_colors'
        USING ERRCODE = 'PT400';
    END IF;
    v_primary_color := p_brand_colors ->> 'primary';
    v_background_color := p_brand_colors ->> 'background';
    v_accent_color := p_brand_colors ->> 'accent';
    IF v_primary_color IS NULL OR v_background_color IS NULL
       OR v_accent_color IS NULL
       OR char_length(v_primary_color) > 64
       OR char_length(v_background_color) > 64
       OR char_length(v_accent_color) > 64
    THEN
      RAISE EXCEPTION 'invalid_brand_colors'
        USING ERRCODE = 'PT400';
    END IF;
  END IF;

  v_full_name := v_first_name || ' ' || v_last_name;
  v_slug_seed := COALESCE(v_requested_slug, v_business_name);
  v_slug_base := pg_catalog.lower(
    pg_catalog.regexp_replace(v_slug_seed, '[^a-zA-Z0-9\s-]', '', 'g')
  );
  v_slug_base := pg_catalog.regexp_replace(v_slug_base, '\s+', '-', 'g');
  v_slug_base := pg_catalog.regexp_replace(v_slug_base, '-+', '-', 'g');
  v_slug_base := pg_catalog.btrim(v_slug_base, '-');
  IF v_slug_base = '' THEN
    v_slug_base := 'store';
  END IF;
  v_slug_base := pg_catalog.rtrim(pg_catalog.left(v_slug_base, 63), '-');

  IF p_slug_is_custom THEN
    IF v_requested_slug IS NULL
       OR NOT (char_length(v_requested_slug) BETWEEN 3 AND 63)
       OR v_requested_slug !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
    THEN
      RAISE EXCEPTION 'invalid_slug'
        USING ERRCODE = 'PT400';
    END IF;
    IF public.is_reserved_merchant_slug(v_requested_slug) THEN
      RAISE EXCEPTION 'slug_unavailable'
        USING ERRCODE = 'PT409';
    END IF;
  END IF;

  SELECT merchant_row.id, merchant_row.slug
    INTO v_merchant_id, v_merchant_slug
  FROM public.merchants AS merchant_row
  WHERE merchant_row.user_id = v_user_id;

  v_slug_locked :=
    v_merchant_id IS NOT NULL
    AND v_merchant_slug IS NOT NULL
    AND pg_catalog.btrim(v_merchant_slug) <> '';

  WHILE v_slug_attempt < v_max_slug_attempts LOOP
    IF v_slug_locked THEN
      v_candidate_slug := v_merchant_slug;
    ELSIF p_slug_is_custom THEN
      v_candidate_slug := v_requested_slug;
    ELSIF v_slug_attempt = 0 THEN
      v_candidate_slug := public.generate_slug(v_slug_seed);
    ELSE
      v_candidate_slug :=
        pg_catalog.rtrim(
          pg_catalog.left(
            v_slug_base,
            63 - char_length('-' || v_slug_attempt::text)
          ),
          '-'
        ) || '-' || v_slug_attempt::text;
    END IF;

    BEGIN
      IF v_merchant_id IS NULL THEN
        INSERT INTO public.merchants (
          user_id,
          email,
          business_name,
          business_type,
          country,
          payout_currency,
          phone,
          logo_url,
          favicon_png_192_url,
          brand_colors,
          slug,
          template_id,
          signup_source
        )
        VALUES (
          v_user_id,
          v_email,
          v_business_name,
          v_final_business_type,
          v_country,
          v_payout_currency,
          v_phone,
          v_logo_url,
          v_logo_url,
          p_brand_colors,
          v_candidate_slug,
          'puck',
          p_signup_source
        )
        RETURNING id, slug INTO v_merchant_id, v_merchant_slug;
        v_created := true;
      ELSIF v_slug_locked THEN
        UPDATE public.merchants
        SET business_name = v_business_name,
            business_type = v_final_business_type,
            country = v_country,
            payout_currency = v_payout_currency,
            phone = v_phone,
            logo_url = COALESCE(v_logo_url, logo_url),
            favicon_png_192_url = COALESCE(
              v_logo_url,
              favicon_png_192_url
            ),
            brand_colors = COALESCE(p_brand_colors, brand_colors)
        WHERE id = v_merchant_id
        RETURNING slug INTO v_merchant_slug;
      ELSE
        UPDATE public.merchants
        SET business_name = v_business_name,
            business_type = v_final_business_type,
            country = v_country,
            payout_currency = v_payout_currency,
            phone = v_phone,
            logo_url = COALESCE(v_logo_url, logo_url),
            favicon_png_192_url = COALESCE(
              v_logo_url,
              favicon_png_192_url
            ),
            brand_colors = COALESCE(p_brand_colors, brand_colors),
            slug = v_candidate_slug,
            signup_source = p_signup_source
        WHERE id = v_merchant_id
        RETURNING slug INTO v_merchant_slug;
      END IF;

      v_platform_domain := v_merchant_slug || '.' || v_root_domain;
      SELECT EXISTS (
        SELECT 1
        FROM public.domains AS primary_domain
        WHERE primary_domain.merchant_id = v_merchant_id
          AND primary_domain.is_primary IS TRUE
      ) INTO v_has_primary;

      v_domain_id := NULL;
      v_domain_is_primary := false;
      SELECT domain_row.id, COALESCE(domain_row.is_primary, false)
        INTO v_domain_id, v_domain_is_primary
      FROM public.domains AS domain_row
      WHERE domain_row.merchant_id = v_merchant_id
        AND pg_catalog.lower(pg_catalog.btrim(domain_row.domain)) =
          v_platform_domain
      ORDER BY domain_row.is_primary DESC, domain_row.created_at
      LIMIT 1;

      IF v_domain_id IS NULL THEN
        INSERT INTO public.domains (
          merchant_id,
          domain,
          tld,
          domain_type,
          status,
          is_primary
        )
        VALUES (
          v_merchant_id,
          v_platform_domain,
          '.' || v_root_domain,
          'subdomain',
          'active',
          NOT v_has_primary
        );
      ELSE
        UPDATE public.domains
        SET domain = v_platform_domain,
            tld = '.' || v_root_domain,
            domain_type = 'subdomain',
            status = 'active',
            is_primary = v_domain_is_primary OR NOT v_has_primary
        WHERE id = v_domain_id;
      END IF;
      v_provisioned := true;
    EXCEPTION
      WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS
          v_constraint_name = CONSTRAINT_NAME,
          v_message_text = MESSAGE_TEXT;

        IF v_constraint_name IN (
          'merchants_user_id_key',
          'merchants_email_key'
        ) THEN
          SELECT merchant_row.id, merchant_row.slug
            INTO v_merchant_id, v_merchant_slug
          FROM public.merchants AS merchant_row
          WHERE merchant_row.user_id = v_user_id;
          IF v_merchant_id IS NULL THEN
            RAISE;
          END IF;
          v_created := false;
          v_slug_locked :=
            v_merchant_slug IS NOT NULL
            AND pg_catalog.btrim(v_merchant_slug) <> '';
          CONTINUE;
        END IF;

        v_merchant_id := NULL;
        v_merchant_slug := NULL;
        SELECT merchant_row.id, merchant_row.slug
          INTO v_merchant_id, v_merchant_slug
        FROM public.merchants AS merchant_row
        WHERE merchant_row.user_id = v_user_id;
        v_created := false;
        v_slug_locked :=
          v_merchant_id IS NOT NULL
          AND v_merchant_slug IS NOT NULL
          AND pg_catalog.btrim(v_merchant_slug) <> '';

        IF v_constraint_name = 'idx_merchants_slug'
           AND v_slug_locked
           AND v_merchant_slug = v_candidate_slug
        THEN
          CONTINUE;
        END IF;

        IF v_constraint_name IN (
          'domains_active_normalized_domain_uidx',
          'domains_one_primary_per_merchant_idx'
        ) AND (
          EXISTS (
            SELECT 1
            FROM public.domains AS same_domain
            WHERE same_domain.merchant_id = v_merchant_id
              AND pg_catalog.lower(pg_catalog.btrim(same_domain.domain)) =
                v_candidate_slug || '.' || v_root_domain
          )
          OR (
            v_constraint_name = 'domains_one_primary_per_merchant_idx'
            AND EXISTS (
              SELECT 1
              FROM public.domains AS same_primary
              WHERE same_primary.merchant_id = v_merchant_id
                AND same_primary.is_primary IS TRUE
            )
          )
        ) THEN
          v_slug_attempt := v_slug_attempt + 1;
          CONTINUE;
        END IF;

        IF v_constraint_name IN (
          'idx_merchants_slug',
          'domains_active_normalized_domain_uidx',
          'domains_one_primary_per_merchant_idx'
        ) OR v_message_text IN (
          'slug_too_long',
          'slug_is_reserved',
          'slug_is_retired_alias'
        ) THEN
          IF p_slug_is_custom OR v_slug_locked THEN
            RAISE EXCEPTION 'slug_unavailable'
              USING ERRCODE = 'PT409';
          END IF;
          v_slug_attempt := v_slug_attempt + 1;
          CONTINUE;
        END IF;

        RAISE;
    END;

    EXIT;
  END LOOP;

  IF NOT v_provisioned
     OR v_merchant_id IS NULL OR v_merchant_slug IS NULL
     OR pg_catalog.btrim(v_merchant_slug) = ''
  THEN
    RAISE EXCEPTION 'slug_unavailable'
      USING ERRCODE = 'PT409';
  END IF;

  WHILE v_staff_attempt < 3 LOOP
    BEGIN
      v_staff_id := NULL;
      v_staff_user_id := NULL;
      v_staff_status := NULL;
      SELECT staff_row.id, staff_row.user_id, staff_row.status
        INTO v_staff_id, v_staff_user_id, v_staff_status
      FROM public.staff_members AS staff_row
      WHERE staff_row.merchant_id = v_merchant_id
        AND staff_row.user_id = v_user_id
      FOR UPDATE;

      IF v_staff_id IS NULL THEN
        SELECT staff_row.id, staff_row.user_id, staff_row.status
          INTO v_staff_id, v_staff_user_id, v_staff_status
        FROM public.staff_members AS staff_row
        WHERE staff_row.merchant_id = v_merchant_id
          AND pg_catalog.lower(staff_row.email) = v_email
        ORDER BY staff_row.created_at
        LIMIT 1
        FOR UPDATE;
      END IF;

      IF v_staff_id IS NOT NULL THEN
        IF v_staff_user_id IS NOT NULL
           AND v_staff_user_id <> v_user_id
        THEN
          RAISE EXCEPTION 'owner_staff_identity_conflict'
            USING ERRCODE = '23505';
        END IF;
        IF v_staff_user_id IS NULL
           AND v_staff_status NOT IN ('pending', 'removed')
        THEN
          RAISE EXCEPTION 'owner_staff_identity_conflict'
            USING ERRCODE = '23505';
        END IF;

        UPDATE public.staff_members
        SET user_id = v_user_id,
            email = v_email,
            name = v_full_name,
            phone = v_phone,
            role = 'admin'::public.staff_role,
            status = 'active',
            invitation_token = NULL,
            invitation_expires_at = NULL,
            accepted_at = COALESCE(accepted_at, pg_catalog.now())
        WHERE id = v_staff_id;
      ELSE
        INSERT INTO public.staff_members (
          user_id,
          merchant_id,
          email,
          name,
          phone,
          role,
          status,
          accepted_at
        )
        VALUES (
          v_user_id,
          v_merchant_id,
          v_email,
          v_full_name,
          v_phone,
          'admin'::public.staff_role,
          'active',
          pg_catalog.now()
        );
      END IF;
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS
          v_constraint_name = CONSTRAINT_NAME,
          v_message_text = MESSAGE_TEXT;
        IF v_constraint_name NOT IN (
          'staff_members_merchant_id_email_key',
          'staff_members_user_id_merchant_id_key'
        ) THEN
          RAISE;
        END IF;
        v_staff_id := NULL;
        v_staff_user_id := NULL;
        v_staff_status := NULL;
        v_staff_attempt := v_staff_attempt + 1;
    END;
  END LOOP;

  IF v_staff_attempt >= 3 THEN
    RAISE EXCEPTION 'owner_staff_reconciliation_failed'
      USING ERRCODE = '23505';
  END IF;

  RETURN QUERY
  SELECT v_merchant_id, v_merchant_slug, v_created;
END;
$function$;

REVOKE ALL ON FUNCTION public.provision_mobile_merchant_v2(
  text, text, text, text, text, text, text, text, boolean, text, jsonb, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_mobile_merchant_v2(
  text, text, text, text, text, text, text, text, boolean, text, jsonb, text
) FROM anon;
REVOKE ALL ON FUNCTION public.provision_mobile_merchant_v2(
  text, text, text, text, text, text, text, text, boolean, text, jsonb, text
) FROM authenticated;
REVOKE ALL ON FUNCTION public.provision_mobile_merchant_v2(
  text, text, text, text, text, text, text, text, boolean, text, jsonb, text
) FROM service_role;
GRANT EXECUTE ON FUNCTION public.provision_mobile_merchant_v2(
  text, text, text, text, text, text, text, text, boolean, text, jsonb, text
) TO authenticated;

COMMENT ON FUNCTION public.provision_mobile_merchant_v2(
  text, text, text, text, text, text, text, text, boolean, text, jsonb, text
) IS 'Atomically provisions the auth.uid()-owned mobile merchant, platform subdomain, and owner staff row.';

-- Preserve the complete pre-v2 policy-health implementation without editing
-- its historical migration, then append exact RPC and dependent-policy facts.
ALTER FUNCTION public.get_merchant_signup_policy_health()
  RENAME TO get_merchant_signup_policy_health_pre_mobile_v2;

REVOKE ALL ON FUNCTION
  public.get_merchant_signup_policy_health_pre_mobile_v2()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_merchant_signup_policy_health()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $health$
  SELECT
    public.get_merchant_signup_policy_health_pre_mobile_v2()
    || pg_catalog.jsonb_build_object(
      'mobile_provisioning_rpc_is_invoker',
      COALESCE((
        SELECT function_row.prosecdef IS FALSE
        FROM pg_catalog.pg_proc AS function_row
        WHERE function_row.oid =
          'public.provision_mobile_merchant_v2(text,text,text,text,text,text,text,text,boolean,text,jsonb,text)'::pg_catalog.regprocedure
      ), FALSE),
      'auth_can_execute_mobile_provisioning_rpc',
      pg_catalog.has_function_privilege(
        'authenticated',
        'public.provision_mobile_merchant_v2(text,text,text,text,text,text,text,text,boolean,text,jsonb,text)',
        'EXECUTE'
      ),
      'anon_cannot_execute_mobile_provisioning_rpc',
      NOT pg_catalog.has_function_privilege(
        'anon',
        'public.provision_mobile_merchant_v2(text,text,text,text,text,text,text,text,boolean,text,jsonb,text)',
        'EXECUTE'
      ),
      'public_cannot_execute_mobile_provisioning_rpc',
      NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_proc AS function_row
        CROSS JOIN LATERAL pg_catalog.aclexplode(
          COALESCE(
            function_row.proacl,
            pg_catalog.acldefault('f', function_row.proowner)
          )
        ) AS privilege_row
        WHERE function_row.oid =
          'public.provision_mobile_merchant_v2(text,text,text,text,text,text,text,text,boolean,text,jsonb,text)'::pg_catalog.regprocedure
          AND privilege_row.grantee = 0
          AND privilege_row.privilege_type = 'EXECUTE'
      ),
      'domain_insert_policy_is_expected',
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_policy AS policy
        WHERE policy.polrelid = 'public.domains'::pg_catalog.regclass
          AND policy.polname = 'Allow merchants to insert their own domains'
          AND policy.polcmd = 'a'
      ),
      'staff_insert_policy_is_expected',
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_policy AS policy
        WHERE policy.polrelid = 'public.staff_members'::pg_catalog.regclass
          AND policy.polname = 'Merchants can invite staff'
          AND policy.polcmd = 'a'
      ),
      'staff_update_policy_is_expected',
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_policy AS policy
        WHERE policy.polrelid = 'public.staff_members'::pg_catalog.regclass
          AND policy.polname = 'Merchants can update own staff'
          AND policy.polcmd = 'w'
      )
    );
$health$;

REVOKE ALL ON FUNCTION public.get_merchant_signup_policy_health() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_merchant_signup_policy_health() FROM anon;
REVOKE ALL ON FUNCTION public.get_merchant_signup_policy_health()
  FROM authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_merchant_signup_policy_health() TO anon;
