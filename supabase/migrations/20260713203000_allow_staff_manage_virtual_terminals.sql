-- Synchronize Paystack-backed terminal changes without granting delegated staff
-- direct INSERT/UPDATE/DELETE access to the underlying table. The RPC exposes
-- only the fields changed by the API after Paystack has accepted the mutation.

CREATE OR REPLACE FUNCTION public.sync_virtual_terminal_local(
  p_merchant_id uuid,
  p_code text,
  p_name text DEFAULT NULL,
  p_active boolean DEFAULT NULL,
  p_account_number text DEFAULT NULL,
  p_account_name text DEFAULT NULL,
  p_bank text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_terminal_id uuid;
  v_user_id uuid := (SELECT auth.uid());
  v_is_owner boolean := false;
  v_staff_permissions jsonb;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.merchants
    WHERE id = p_merchant_id
      AND user_id = v_user_id
  ) INTO v_is_owner;

  SELECT public.get_staff_permissions(sm.id)
  INTO v_staff_permissions
  FROM public.staff_members AS sm
  WHERE sm.merchant_id = p_merchant_id
    AND sm.user_id = v_user_id
    AND sm.status = 'active';

  IF v_user_id IS NULL OR NOT (
    v_is_owner
    OR public.check_staff_permission(
      v_user_id,
      p_merchant_id,
      'integrations',
      'manage'
    )
    OR COALESCE((v_staff_permissions -> '*' ->> '*')::boolean, false)
    OR COALESCE((v_staff_permissions -> '*' ->> 'manage')::boolean, false)
    OR COALESCE(
      (v_staff_permissions -> 'integrations' ->> '*')::boolean,
      false
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to sync this virtual terminal'
      USING ERRCODE = '42501';
  END IF;

  -- Merchant owners already own these rows under RLS. Delegated staff cannot
  -- synchronize account details because direct RPC callers could forge data
  -- that was not returned by Paystack.
  IF NOT v_is_owner AND (
    p_account_number IS NOT NULL
    OR p_account_name IS NOT NULL
    OR p_bank IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Delegated staff cannot synchronize account details'
      USING ERRCODE = '42501';
  END IF;

  IF p_code !~ '^VT_[A-Za-z0-9]+$' THEN
    RAISE EXCEPTION 'Invalid virtual terminal code'
      USING ERRCODE = '22023';
  END IF;

  IF p_name IS NULL AND p_active IS NULL THEN
    RAISE EXCEPTION 'A terminal name or active-state change is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_name IS NOT NULL AND char_length(btrim(p_name)) < 2 THEN
    RAISE EXCEPTION 'Terminal name must contain at least two characters'
      USING ERRCODE = '22023';
  END IF;

  -- This API only deactivates terminals. Re-enabling a Paystack terminal needs
  -- its own provider-backed flow before local state may change.
  IF p_active IS TRUE THEN
    RAISE EXCEPTION 'Virtual terminals cannot be activated through local sync'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.virtual_terminals
  SET
    name = COALESCE(btrim(p_name), name),
    active = COALESCE(p_active, active),
    account_number = COALESCE(
      NULLIF(btrim(p_account_number), ''),
      account_number
    ),
    account_name = COALESCE(
      NULLIF(btrim(p_account_name), ''),
      account_name
    ),
    bank = COALESCE(NULLIF(btrim(p_bank), ''), bank),
    updated_at = now()
  WHERE merchant_id = p_merchant_id
    AND code = p_code
  RETURNING id INTO v_terminal_id;

  IF v_terminal_id IS NOT NULL THEN
    RETURN v_terminal_id;
  END IF;

  -- Backfills are limited to the merchant's existing legacy terminal. This
  -- prevents a staff token from inventing arbitrary local Paystack terminals.
  IF NOT EXISTS (
    SELECT 1
    FROM public.merchants
    WHERE id = p_merchant_id
      AND virtual_terminal_code = p_code
  ) THEN
    RAISE EXCEPTION 'Legacy virtual terminal does not belong to this merchant'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.virtual_terminals (
    merchant_id,
    code,
    name,
    account_number,
    account_name,
    bank,
    payment_link,
    active
  )
  VALUES (
    p_merchant_id,
    p_code,
    COALESCE(btrim(p_name), 'Legacy Virtual Terminal'),
    NULLIF(btrim(p_account_number), ''),
    NULLIF(btrim(p_account_name), ''),
    NULLIF(btrim(p_bank), ''),
    'https://paystack.com/vt/' || p_code,
    COALESCE(p_active, true)
  )
  ON CONFLICT (code) DO UPDATE
  SET
    name = COALESCE(btrim(p_name), public.virtual_terminals.name),
    active = COALESCE(p_active, public.virtual_terminals.active),
    account_number = COALESCE(
      EXCLUDED.account_number,
      public.virtual_terminals.account_number
    ),
    account_name = COALESCE(
      EXCLUDED.account_name,
      public.virtual_terminals.account_name
    ),
    bank = COALESCE(EXCLUDED.bank, public.virtual_terminals.bank),
    updated_at = now()
  WHERE public.virtual_terminals.merchant_id = p_merchant_id
  RETURNING id INTO v_terminal_id;

  IF v_terminal_id IS NULL THEN
    RAISE EXCEPTION 'Virtual terminal code belongs to another merchant'
      USING ERRCODE = '42501';
  END IF;

  RETURN v_terminal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_virtual_terminal_local(
  uuid,
  text,
  text,
  boolean,
  text,
  text,
  text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.sync_virtual_terminal_local(
  uuid,
  text,
  text,
  boolean,
  text,
  text,
  text
) TO authenticated, service_role;

COMMENT ON FUNCTION public.sync_virtual_terminal_local(
  uuid,
  text,
  text,
  boolean,
  text,
  text,
  text
) IS 'Synchronizes provider-confirmed virtual-terminal name/deactivation changes for authorized owners or integrations.manage staff without granting direct table writes.';

NOTIFY pgrst, 'reload schema';
