-- Fix accept_staff_invite failing with "column reference id is ambiguous".
-- The function returns a column named id, so every SQL table reference must use
-- explicit aliases to avoid PL/pgSQL output-parameter ambiguity.
--
-- Security: the invite's email is verified against the *server-trusted* email of
-- the authenticated caller (auth.users, with a JWT-claim fallback). The
-- client-supplied p_email argument is retained only for call-signature
-- compatibility and is NEVER trusted for authorization — otherwise any
-- authenticated user holding a valid token could claim another person's invite
-- by passing the victim's email.

CREATE OR REPLACE FUNCTION public.accept_staff_invite(
  p_token text,
  p_email text
)
RETURNS TABLE(
  id uuid,
  merchant_id uuid,
  role public.staff_role,
  status text,
  merchant_business_name text,
  merchant_slug text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_caller_email text;
  v_invitation public.staff_members%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Resolve the caller's email from server-trusted sources only. Prefer the
  -- verified auth.users record; fall back to the signed JWT email claim. The
  -- client-provided p_email is intentionally ignored here.
  SELECT lower(u.email)
    INTO v_caller_email
    FROM auth.users AS u
   WHERE u.id = v_user_id;

  v_caller_email := COALESCE(
    v_caller_email,
    lower(NULLIF(current_setting('request.jwt.claim.email', true), '')),
    lower(NULLIF(auth.jwt() ->> 'email', ''))
  );

  IF v_caller_email IS NULL THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  SELECT sm.*
    INTO v_invitation
    FROM public.staff_members AS sm
   WHERE sm.invitation_token = p_token
   LIMIT 1
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_invite';
  END IF;

  IF v_invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'invite_used';
  END IF;

  IF v_invitation.invitation_expires_at IS NOT NULL
     AND v_invitation.invitation_expires_at < now() THEN
    RAISE EXCEPTION 'invite_expired';
  END IF;

  -- Authorize against the caller's server-trusted email, never the client input.
  IF lower(v_invitation.email) <> v_caller_email THEN
    RAISE EXCEPTION 'email_mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.merchants AS m
     WHERE m.id = v_invitation.merchant_id
       AND m.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'already_owner';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.staff_members AS existing_sm
     WHERE existing_sm.merchant_id = v_invitation.merchant_id
       AND existing_sm.user_id = v_user_id
       AND existing_sm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'already_staff';
  END IF;

  UPDATE public.staff_members AS sm
     SET user_id = v_user_id,
         status = 'active',
         accepted_at = now(),
         invitation_token = NULL
   WHERE sm.id = v_invitation.id;

  RETURN QUERY
  SELECT sm.id,
         sm.merchant_id,
         sm.role,
         sm.status,
         m.business_name,
         m.slug
    FROM public.staff_members AS sm
    JOIN public.merchants AS m ON m.id = sm.merchant_id
   WHERE sm.id = v_invitation.id;
END;
$$;

ALTER FUNCTION public.accept_staff_invite(text, text) OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.accept_staff_invite(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_staff_invite(text, text) TO authenticated, service_role;
