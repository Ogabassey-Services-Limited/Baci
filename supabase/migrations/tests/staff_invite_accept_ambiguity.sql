-- =============================================
-- REGRESSION TEST: staff invite acceptance id ambiguity
--   Validates 20260701110000_fix_staff_invite_accept_ambiguity.sql.
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/staff_invite_accept_ambiguity.sql
-- =============================================

BEGIN;

DO $$
DECLARE
  v_merchant_id uuid := '8f0ed783-0000-4000-8000-000000000701';
  v_owner_id uuid := '8f0ed783-0000-4000-8000-000000000702';
  v_invitee_id uuid := '8f0ed783-0000-4000-8000-000000000703';
  v_staff_id uuid := '8f0ed783-0000-4000-8000-000000000704';
  v_result record;
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_trigger AS t
      JOIN pg_class AS c ON c.oid = t.tgrelid
      JOIN pg_namespace AS n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'staff_members'
       AND t.tgname = 'on_staff_invite'
       AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'on_staff_invite trigger still exists and can send duplicate invite emails';
  END IF;

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
      v_owner_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      format('staff-invite-owner-%s@example.com', txid_current()),
      'test',
      now(),
      now(),
      now(),
      '{}'::jsonb,
      '{}'::jsonb
    ),
    (
      v_invitee_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      format('staff-invitee-%s@example.com', txid_current()),
      'test',
      now(),
      now(),
      now(),
      '{}'::jsonb,
      '{}'::jsonb
    );

  INSERT INTO public.merchants (id, user_id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    v_owner_id,
    format('staff-invite-store-%s@example.com', txid_current()),
    'Staff Invite Store',
    format('staff-invite-store-%s', txid_current())
  );

  INSERT INTO public.staff_members (
    id,
    merchant_id,
    email,
    name,
    role,
    status,
    invitation_token,
    invitation_expires_at
  )
  VALUES (
    v_staff_id,
    v_merchant_id,
    'new-staff@example.com',
    'New Staff',
    'sales_rep',
    'pending',
    'staff-invite-token-ambiguity',
    now() + interval '7 days'
  );

  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_invitee_id::text, true);

  SELECT *
    INTO v_result
    FROM public.accept_staff_invite(
      'staff-invite-token-ambiguity',
      'new-staff@example.com'
    );

  IF v_result.id IS DISTINCT FROM v_staff_id THEN
    RAISE EXCEPTION 'accepted invite returned wrong staff id: %', v_result.id;
  END IF;

  IF v_result.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'accepted invite returned wrong status: %', v_result.status;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.staff_members AS sm
     WHERE sm.id = v_staff_id
       AND sm.invitation_token IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'accepted invite did not clear invitation token';
  END IF;

  RAISE NOTICE 'OK: accept_staff_invite accepted without id ambiguity';
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
