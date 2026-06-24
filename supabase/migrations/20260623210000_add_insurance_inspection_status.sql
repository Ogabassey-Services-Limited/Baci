-- Track the pre-loss inspection state of an insurance policy.
--
-- Gadget cover (is_inspectable products) requires a post-purchase "pre-loss"
-- inspection — the customer uploads device photos/video on MyCover's hosted
-- page to activate coverage. MyCover signals completion via the
-- `inspection.completed` webhook (category = "preloss"). Storing the state lets
-- the storefront switch the policy action from "Complete Inspection" to
-- "File a Claim" once the inspection is done.
--
-- Values: 'pending' (awaiting inspection) | 'completed'. Existing policies are
-- intentionally left NULL because historical rows may already have completed a
-- MyCover inspection before we started storing the webhook state. Policies that
-- never carry an inspection link (non-inspectable products) ignore this column
-- — the UI gates on the presence of `inspection_link`.

ALTER TABLE "public"."order_insurance_policies"
  ADD COLUMN IF NOT EXISTS "inspection_status" "text";
