-- BYOK fee accrual ledger, split out of 20260723000001 (Codex #3171): the fee
-- ledger is a distinct concern from the credential vault, so it lives in its own
-- migration. Written only by service_role; merchants + active staff read own rows.
-- (Fee is waived at day one — see record-byok-fee-accrual.ts.)

CREATE TABLE IF NOT EXISTS public.byok_fee_accruals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  order_id uuid,
  transaction_reference text,
  provider text NOT NULL,
  currency text NOT NULL,
  order_amount numeric NOT NULL,
  fee_amount numeric NOT NULL DEFAULT 0,
  waived boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS byok_fee_accruals_merchant_id_created_at_idx
  ON public.byok_fee_accruals (merchant_id, created_at);

ALTER TABLE public.byok_fee_accruals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.byok_fee_accruals FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.byok_fee_accruals TO authenticated;
GRANT ALL ON TABLE public.byok_fee_accruals TO service_role;

DROP POLICY IF EXISTS byok_fee_accruals_owner_staff_select ON public.byok_fee_accruals;
CREATE POLICY byok_fee_accruals_owner_staff_select
  ON public.byok_fee_accruals
  FOR SELECT
  TO authenticated
  USING (
    merchant_id IN (
      SELECT id
      FROM public.merchants
      WHERE user_id = (SELECT auth.uid())
      UNION
      SELECT staff_members.merchant_id
      FROM public.staff_members
      WHERE staff_members.user_id = (SELECT auth.uid())
        AND staff_members.status = 'active'
    )
  );

COMMENT ON TABLE public.byok_fee_accruals IS
  'Fee accrual record for BYOK settlement lanes (fee waived at day one). Written only by service_role; merchants and their active staff can read their own rows.';
