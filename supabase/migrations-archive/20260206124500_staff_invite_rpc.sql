-- Migration: Staff invite preview/accept RPCs
-- Created: 2026-02-06
-- Description: Secure public preview and authenticated acceptance without service role usage

CREATE OR REPLACE FUNCTION public.get_staff_invite_preview(
  p_token TEXT
)
RETURNS TABLE (
  email TEXT,
  role staff_role,
  status TEXT,
  invitation_expires_at TIMESTAMPTZ,
  merchant_business_name TEXT,
  merchant_slug TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sm.email,
    sm.role,
    sm.status,
    sm.invitation_expires_at,
    m.business_name,
    m.slug
  FROM staff_members sm
  JOIN merchants m ON m.id = sm.merchant_id
  WHERE sm.invitation_token = p_token
    AND sm.status = 'pending'
    AND (sm.invitation_expires_at IS NULL OR sm.invitation_expires_at > NOW())
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_invite_preview(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.accept_staff_invite(
  p_token TEXT,
  p_email TEXT
)
RETURNS TABLE (
  id UUID,
  merchant_id UUID,
  role staff_role,
  status TEXT,
  merchant_business_name TEXT,
  merchant_slug TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_invitation staff_members%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_invitation
  FROM staff_members
  WHERE invitation_token = p_token
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_invite';
  END IF;

  IF v_invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'invite_used';
  END IF;

  IF v_invitation.invitation_expires_at IS NOT NULL
     AND v_invitation.invitation_expires_at < NOW() THEN
    RAISE EXCEPTION 'invite_expired';
  END IF;

  IF lower(v_invitation.email) <> lower(trim(p_email)) THEN
    RAISE EXCEPTION 'email_mismatch';
  END IF;

  IF EXISTS (
    SELECT 1 FROM merchants
    WHERE id = v_invitation.merchant_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'already_owner';
  END IF;

  IF EXISTS (
    SELECT 1 FROM staff_members
    WHERE merchant_id = v_invitation.merchant_id
      AND user_id = v_user_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'already_staff';
  END IF;

  UPDATE staff_members
  SET
    user_id = v_user_id,
    status = 'active',
    accepted_at = NOW(),
    invitation_token = NULL
  WHERE id = v_invitation.id;

  RETURN QUERY
  SELECT
    sm.id,
    sm.merchant_id,
    sm.role,
    sm.status,
    m.business_name,
    m.slug
  FROM staff_members sm
  JOIN merchants m ON m.id = sm.merchant_id
  WHERE sm.id = v_invitation.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_staff_invite(TEXT, TEXT) TO authenticated;
