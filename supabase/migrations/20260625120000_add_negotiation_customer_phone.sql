-- Add an optional contact number to negotiation offers.
--
-- Most merchant-approval offers come from guests (no customer_id), and the
-- decision notification path only reaches authenticated customers via push —
-- guests get nothing. Capturing a phone/WhatsApp number at offer time gives the
-- merchant a reliable way to follow up (call / WhatsApp) regardless of whether
-- the customer is signed in. Nullable: the storefront field is optional, so
-- existing rows and guests who skip it simply have no number.

ALTER TABLE "public"."negotiation_requests"
  ADD COLUMN IF NOT EXISTS "customer_phone" "text";

COMMENT ON COLUMN "public"."negotiation_requests"."customer_phone" IS
  'Optional E.164-normalized contact number captured at offer time so the merchant can follow up by call/WhatsApp. Null for offers submitted without one.';
