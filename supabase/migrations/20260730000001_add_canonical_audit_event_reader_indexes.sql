-- Keep each supported reader filter aligned with the cursor order. The original
-- resource-id index remains useful for exact resource lookups; these indexes
-- avoid scanning or sorting an unbounded merchant ledger for reader RPC pages.

CREATE INDEX IF NOT EXISTS idx_audit_events_resource_type_occurred_id
  ON public.audit_events (merchant_id, resource_type, occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_action_occurred_id
  ON public.audit_events (merchant_id, action, occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_resource_type_action_occurred_id
  ON public.audit_events (
    merchant_id, resource_type, action, occurred_at DESC, id DESC
  );
