-- Make virtual terminal ownership and provider synchronization server-controlled.
-- Existing legacy mappings are materialized before authenticated writes are
-- removed so detail routes no longer need to trust merchants.virtual_terminal_code.

INSERT INTO public.virtual_terminals (
  merchant_id,
  code,
  name,
  payment_link,
  active
)
SELECT
  merchants.id,
  merchants.virtual_terminal_code,
  'Legacy Virtual Terminal',
  'https://paystack.com/vt/' || merchants.virtual_terminal_code,
  true
FROM public.merchants
WHERE merchants.virtual_terminal_code ~ '^VT_[A-Za-z0-9]+$'
ON CONFLICT (code) DO NOTHING;

DROP POLICY IF EXISTS "Merchants can create terminals"
  ON public.virtual_terminals;
DROP POLICY IF EXISTS "Merchants can update own terminals"
  ON public.virtual_terminals;
DROP POLICY IF EXISTS "Merchants can delete own terminals"
  ON public.virtual_terminals;

REVOKE INSERT, UPDATE, DELETE ON public.virtual_terminals
  FROM anon, authenticated;

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
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_terminal_id uuid;
BEGIN
  IF p_code !~ '^VT_[A-Za-z0-9]+$' THEN
    RAISE EXCEPTION 'Invalid virtual terminal code'
      USING ERRCODE = '22023';
  END IF;

  IF p_name IS NULL
    AND p_active IS NULL
    AND p_account_number IS NULL
    AND p_account_name IS NULL
    AND p_bank IS NULL
  THEN
    RAISE EXCEPTION 'A terminal name, active-state, or account detail change is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_name IS NOT NULL AND char_length(btrim(p_name)) < 2 THEN
    RAISE EXCEPTION 'Terminal name must contain at least two characters'
      USING ERRCODE = '22023';
  END IF;

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

  IF v_terminal_id IS NULL THEN
    RAISE EXCEPTION 'Trusted virtual terminal mapping not found'
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
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sync_virtual_terminal_local(
  uuid,
  text,
  text,
  boolean,
  text,
  text,
  text
) TO service_role;

COMMENT ON FUNCTION public.sync_virtual_terminal_local(
  uuid,
  text,
  text,
  boolean,
  text,
  text,
  text
) IS 'Server-only synchronization of provider-confirmed virtual-terminal changes.';

NOTIFY pgrst, 'reload schema';
