-- Idempotency guard for the "Activate Protection" delivery push.
--
-- When an order carrying gadget cover is delivered, we send the customer a
-- one-time push prompting them to complete the pre-loss inspection that
-- activates their policy. Delivery can be reported by several paths (carrier
-- webhook, merchant manual update, customer tracking sync), so this timestamp
-- lets the reminder be claimed-and-sent exactly once per policy.

ALTER TABLE "public"."order_insurance_policies"
  ADD COLUMN IF NOT EXISTS "activation_reminder_sent_at" timestamp with time zone;
