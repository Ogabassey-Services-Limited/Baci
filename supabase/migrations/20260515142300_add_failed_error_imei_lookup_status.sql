ALTER TABLE public.imei_lookups
  DROP CONSTRAINT IF EXISTS imei_lookups_status_check;

ALTER TABLE public.imei_lookups
  ADD CONSTRAINT imei_lookups_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'wallet_rejected'::text,
        'failed_error'::text,
        'refunded_error'::text,
        'refunded_not_found'::text,
        'refund_pending'::text,
        'completed'::text
      ]
    )
  );
