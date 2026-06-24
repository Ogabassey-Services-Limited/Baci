-- Richer claim lifecycle state + webhook idempotency for the MyCover integration.
--
-- MyCover's claim events carry a detailed status (`data.essential.status`),
-- a workflow milestone (`data.meta.progress`) and, on declines/rejections, a
-- reason (`data.essential.comment`). We previously collapsed everything into a
-- single coarse `claim_status`, losing the offer / decline / payout detail the
-- customer needs to see.

ALTER TABLE "public"."order_insurance_policies"
  ADD COLUMN IF NOT EXISTS "claim_stage" "text",
  ADD COLUMN IF NOT EXISTS "claim_progress" "text",
  ADD COLUMN IF NOT EXISTS "claim_comment" "text";

-- Idempotency ledger: MyCover retries a webhook up to ~10 times, each carrying
-- a stable `event_id`. Recording processed ids lets the handler short-circuit
-- duplicate deliveries instead of replaying state mutations.
CREATE TABLE IF NOT EXISTS "public"."mycover_webhook_events" (
  "event_id" "text" PRIMARY KEY,
  "event" "text",
  "received_at" timestamp with time zone DEFAULT "now"()
);

-- Service-role only: the webhook handler uses the admin client. Enabling RLS
-- with no policy denies all anon/authenticated access by default.
ALTER TABLE "public"."mycover_webhook_events" ENABLE ROW LEVEL SECURITY;
