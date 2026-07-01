-- Persist MyCover hosted claim and inspection links on insurance policies.
--
-- MyCover.ai exposes no REST endpoint to file a claim or run a device
-- inspection; both are completed through hosted links that MyCover generates
-- and delivers in the `purchase.successful` webhook under `data.sdk`
-- (`claim_link`, `inspection_link`). Storing them lets the storefront (web +
-- mobile) open the official claim/inspection flow directly instead of relying
-- on the public-key SDK workaround.

ALTER TABLE "public"."order_insurance_policies"
  ADD COLUMN IF NOT EXISTS "claim_link" "text",
  ADD COLUMN IF NOT EXISTS "inspection_link" "text";
