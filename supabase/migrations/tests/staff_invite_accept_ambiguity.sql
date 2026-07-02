-- =============================================
-- REGRESSION TEST: staff invite acceptance id ambiguity + email authorization
--   Validates 20260701110000_fix_staff_invite_accept_ambiguity.sql.
--
--   Covers:
--     1. accept_staff_invite succeeds without "column reference id is ambiguous".
--     2. The on_staff_invite duplicate-email trigger is gone.
--     3. SECURITY: acceptance is authorized against the caller's server-trusted
--        email (auth.users / JWT claim), NOT the client-supplied p_email. A
--        caller who spoofs p_email to the invited address is rejected with
--        email_mismatch.
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
  v_attacker_id uuid := '8f0ed783-0000-4000-8000-000000000705';
  v_owner_invitee_id uuid := '8f0ed783-0000-4000-8000-000000000706';
  v_owner_invitee_store_id uuid := '8f0ed783-0000-4000-8000-000000000707';
  v_owner_invitee_staff_id uuid := '8f0ed783-0000-4000-8000-000000000708';
  v_invite_email text := 'new-staff@example.com';
  v_owner_invitee_email text := format('owner-invitee-%s@example.com', txid_current());
  v_attacker_email text := format('staff-attacker-%s@example.com', txid_current());
  v_result record;
  v_rejected boolean := false;
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
      -- The genuine invitee's verified email matches the invitation.
      v_invitee_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_invite_email,
      'test',
      now(),
      now(),
      now(),
      '{}'::jsonb,
      '{}'::jsonb
    ),
    (
      -- An attacker with a valid token but a different verified email.
      v_attacker_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_attacker_email,
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
    v_invite_email,
    'New Staff',
    'sales_rep',
    'pending',
    'staff-invite-token-ambiguity',
    now() + interval '7 days'
  );

  -- ---------------------------------------------------------------------------
  -- SECURITY: an attacker spoofs p_email to the invited address, but their
  -- server-trusted email differs -> must be rejected, invite must stay pending.
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_attacker_id::text, true);
  PERFORM set_config('request.jwt.claim.email', v_attacker_email, true);

  BEGIN
    PERFORM public.accept_staff_invite(
      'staff-invite-token-ambiguity',
      v_invite_email
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'email_mismatch' THEN
        RAISE EXCEPTION 'attacker accept raised unexpected error: %', SQLERRM;
      END IF;
      v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'SECURITY: attacker accepted an invite by spoofing p_email';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.staff_members AS sm
     WHERE sm.id = v_staff_id
       AND sm.status = 'pending'
       AND sm.invitation_token = 'staff-invite-token-ambiguity'
       AND sm.user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'SECURITY: rejected attacker attempt still mutated the invite';
  END IF;

  RAISE NOTICE 'OK: spoofed p_email rejected with email_mismatch';

  -- ---------------------------------------------------------------------------
  -- An existing store OWNER who is invited as staff to another store must be
  -- rejected (owner_cannot_join_as_staff) without consuming the invite, since
  -- there is no cross-merchant switcher to reach the invited store.
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  )
  VALUES (
    v_owner_invitee_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', v_owner_invitee_email, 'test', now(), now(), now(), '{}', '{}'
  );

  -- This invitee already owns their own published-ish store.
  INSERT INTO public.merchants (id, user_id, email, business_name, slug)
  VALUES (
    v_owner_invitee_store_id, v_owner_invitee_id,
    format('owner-invitee-store-%s@example.com', txid_current()),
    'Owner Invitee Store', format('owner-invitee-store-%s', txid_current())
  );

  -- ...and holds a pending staff invite to the OTHER store.
  INSERT INTO public.staff_members (
    id, merchant_id, email, name, role, status,
    invitation_token, invitation_expires_at
  )
  VALUES (
    v_owner_invitee_staff_id, v_merchant_id, v_owner_invitee_email,
    'Owner Invitee', 'sales_rep', 'pending',
    'owner-invitee-token', now() + interval '7 days'
  );

  PERFORM set_config('request.jwt.claim.sub', v_owner_invitee_id::text, true);
  PERFORM set_config('request.jwt.claim.email', v_owner_invitee_email, true);

  v_rejected := false;
  BEGIN
    PERFORM public.accept_staff_invite('owner-invitee-token', v_owner_invitee_email);
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'owner_cannot_join_as_staff' THEN
        RAISE EXCEPTION 'owner-invitee accept raised unexpected error: %', SQLERRM;
      END IF;
      v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'store owner was allowed to join another store as staff';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.staff_members AS sm
     WHERE sm.id = v_owner_invitee_staff_id
       AND sm.status = 'pending'
       AND sm.invitation_token = 'owner-invitee-token'
       AND sm.user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'rejected owner-invitee attempt still mutated the invite';
  END IF;

  RAISE NOTICE 'OK: store owner rejected with owner_cannot_join_as_staff';

  -- ---------------------------------------------------------------------------
  -- The genuine invitee accepts. Their verified email matches the invitation.
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_invitee_id::text, true);
  PERFORM set_config('request.jwt.claim.email', v_invite_email, true);

  SELECT *
    INTO v_result
    FROM public.accept_staff_invite(
      'staff-invite-token-ambiguity',
      v_invite_email
    );

  IF v_result.id IS DISTINCT FROM v_staff_id THEN
    RAISE EXCEPTION 'accepted invite returned wrong staff id: %', v_result.id;
  END IF;

  IF v_result.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'accepted invite returned wrong status: %', v_result.status;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.staff_members AS sm
     WHERE sm.id = v_staff_id
       AND sm.user_id = v_invitee_id
       AND sm.invitation_token IS NULL
  ) THEN
    RAISE EXCEPTION 'accepted invite did not link the invitee or clear the token';
  END IF;

  RAISE NOTICE 'OK: accept_staff_invite accepted without id ambiguity';
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
