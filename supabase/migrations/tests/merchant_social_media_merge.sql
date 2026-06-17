-- =============================================
-- REGRESSION TEST: atomic merchant social_media merge
--   Validates 20260617000300_atomic_merchant_social_media_merge.sql.
-- =============================================
BEGIN;

DO $$
DECLARE
  v_mid uuid := '8f0ed783-0000-4000-8000-000000000401';
  v_owner_uid uuid := '8f0ed783-0000-4000-8000-000000000402';
  v_staff_uid uuid := '8f0ed783-0000-4000-8000-000000000403';
  v_settings_staff_uid uuid := '8f0ed783-0000-4000-8000-000000000404';
  v_result jsonb;
  v_social jsonb;
  v_legal_entity_name text;
  v_state_code text;
BEGIN
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  )
  VALUES
    (
      v_owner_uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      format('social-merge-owner-%s-%s@example.com', v_owner_uid, txid_current()),
      'test',
      now(),
      now(),
      now(),
      '{}'::jsonb,
      '{}'::jsonb
    ),
    (
      v_staff_uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      format('social-merge-staff-%s-%s@example.com', v_staff_uid, txid_current()),
      'test',
      now(),
      now(),
      now(),
      '{}'::jsonb,
      '{}'::jsonb
    ),
    (
      v_settings_staff_uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      format('social-merge-settings-staff-%s-%s@example.com', v_settings_staff_uid, txid_current()),
      'test',
      now(),
      now(),
      now(),
      '{}'::jsonb,
      '{}'::jsonb
    )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.merchants (id, user_id, email, business_name, social_media)
  VALUES (
    v_mid,
    v_owner_uid,
    format('social-merge-%s-%s@example.com', v_mid, txid_current()),
    'Social Merge Store',
    jsonb_build_object('twitter', '@old', 'facebook', 'fb.com/old')
  );

  INSERT INTO public.staff_members (
    id,
    merchant_id,
    user_id,
    email,
    name,
    role,
    permissions,
    status
  )
  VALUES
    (
      '8f0ed783-0000-4000-8000-000000000405',
      v_mid,
      v_staff_uid,
      format('social-merge-staff-%s-%s@example.com', v_staff_uid, txid_current()),
      'Read Only Staff',
      'sales_rep',
      '{}'::jsonb,
      'active'
    ),
    (
      '8f0ed783-0000-4000-8000-000000000406',
      v_mid,
      v_settings_staff_uid,
      format('social-merge-settings-staff-%s-%s@example.com', v_settings_staff_uid, txid_current()),
      'Settings Staff',
      'sales_rep',
      '{"settings": {"edit": true}}'::jsonb,
      'active'
    );

  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_owner_uid::text, true);

  PERFORM public.update_merchant_social_media(
    v_mid,
    jsonb_build_object('instagram', '@new'),
    false
  );

  SELECT social_media INTO v_social FROM public.merchants WHERE id = v_mid;
  IF v_social IS DISTINCT FROM jsonb_build_object('twitter', '@old', 'facebook', 'fb.com/old', 'instagram', '@new') THEN
    RAISE EXCEPTION 'partial merge did not preserve existing handles: %', v_social;
  END IF;

  PERFORM public.update_merchant_social_media(
    v_mid,
    jsonb_build_object('twitter', ''),
    false
  );

  SELECT social_media INTO v_social FROM public.merchants WHERE id = v_mid;
  IF v_social IS DISTINCT FROM jsonb_build_object('facebook', 'fb.com/old', 'instagram', '@new') THEN
    RAISE EXCEPTION 'blank key did not remove just that handle: %', v_social;
  END IF;

  PERFORM public.update_merchant_social_media(v_mid, '{}'::jsonb, true);
  SELECT social_media INTO v_social FROM public.merchants WHERE id = v_mid;
  IF v_social IS DISTINCT FROM '{}'::jsonb THEN
    RAISE EXCEPTION 'explicit clear did not remove every handle: %', v_social;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_staff_uid::text, true);
  BEGIN
    PERFORM public.update_merchant_social_media(
      v_mid,
      jsonb_build_object('instagram', '@bypass'),
      false
    );
    RAISE EXCEPTION 'staff without settings.edit updated social_media';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', v_settings_staff_uid::text, true);
  PERFORM public.update_merchant_social_media(
    v_mid,
    jsonb_build_object('instagram', '@staff'),
    false
  );

  SELECT social_media INTO v_social FROM public.merchants WHERE id = v_mid;
  IF v_social IS DISTINCT FROM jsonb_build_object('instagram', '@staff') THEN
    RAISE EXCEPTION 'settings staff could not update social_media: %', v_social;
  END IF;

  v_result := public.update_merchant_social_media(
    v_mid,
    jsonb_build_object('youtube', 'https://youtube.com/@baci'),
    false,
    jsonb_build_object(
      'legal_entity_name', 'Baci Atomic Ltd',
      'state_code', 'NG-LA'
    )
  );

  IF v_result ? 'nin' OR v_result ? 'bvn' OR v_result ? 'firs_credentials_encrypted' THEN
    RAISE EXCEPTION 'RPC returned sensitive merchant columns: %', v_result;
  END IF;

  IF v_result ->> 'legal_entity_name' IS DISTINCT FROM 'Baci Atomic Ltd'
    OR v_result ->> 'state_code' IS DISTINCT FROM 'NG-LA' THEN
    RAISE EXCEPTION 'RPC did not return the settings projection: %', v_result;
  END IF;

  SELECT social_media, legal_entity_name, state_code
    INTO v_social, v_legal_entity_name, v_state_code
    FROM public.merchants
   WHERE id = v_mid;

  IF v_social IS DISTINCT FROM jsonb_build_object(
      'instagram', '@staff',
      'youtube', 'https://youtube.com/@baci'
    )
    OR v_legal_entity_name IS DISTINCT FROM 'Baci Atomic Ltd'
    OR v_state_code IS DISTINCT FROM 'NG-LA' THEN
    RAISE EXCEPTION 'mixed social/settings update was not atomic: %, %, %',
      v_social,
      v_legal_entity_name,
      v_state_code;
  END IF;

  BEGIN
    PERFORM public.update_merchant_social_media(
      v_mid,
      jsonb_build_object('website', 'https://usebaci.com'),
      false
    );
    RAISE EXCEPTION 'invalid social-media key was accepted';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      NULL;
  END;

  BEGIN
    PERFORM public.update_merchant_social_media(
      v_mid,
      '{}'::jsonb,
      false,
      jsonb_build_object('state_code', 'NG-LAGOS-TOO-LONG')
    );
    RAISE EXCEPTION 'oversized state_code was accepted';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      NULL;
  END;

  RAISE NOTICE 'OK: merchant settings/social_media merge is atomic, narrow, validated, clearable, and permission-gated';
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
