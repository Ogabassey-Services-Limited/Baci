-- Customer-facing tracking refreshes must not expose a SECURITY DEFINER helper
-- that can be called directly by authenticated customers to mark their own
-- orders delivered. Carrier-delivered persistence stays limited to trusted
-- server/webhook/admin paths that already verified the carrier result.
DROP FUNCTION IF EXISTS "public"."persist_customer_delivered_tracking"(
  "uuid",
  "uuid",
  "uuid",
  "text",
  timestamp with time zone,
  timestamp with time zone,
  "jsonb"
);
