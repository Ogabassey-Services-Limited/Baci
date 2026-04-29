-- SECURITY DEFINER is limited to service_role-only voucher repair; search_path
-- is pinned to prevent injection through caller-controlled schemas.
CREATE OR REPLACE FUNCTION public.set_vtu_transaction_voucher_pin(
  p_transaction_id uuid,
  p_voucher_pin text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_voucher_pin text := NULLIF(BTRIM(p_voucher_pin), '');
BEGIN
  IF v_voucher_pin IS NULL THEN
    RAISE EXCEPTION 'Voucher pin cannot be empty'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.vtu_transactions
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{voucherPin}',
    to_jsonb(v_voucher_pin),
    true
  )
  WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VTU transaction % not found while setting voucher pin',
      p_transaction_id
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_vtu_transaction_voucher_pin(uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.set_vtu_transaction_voucher_pin(uuid, text)
TO service_role;
