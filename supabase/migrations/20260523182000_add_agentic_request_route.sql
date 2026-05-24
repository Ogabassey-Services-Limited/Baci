ALTER TABLE public.agentic_request_records
  ADD COLUMN IF NOT EXISTS route text;

COMMENT ON COLUMN public.agentic_request_records.route IS
  'Non-secret agentic mutation route name used for merchant dashboard request provenance.';
