-- Constrain inspection_status to the documented state machine.
--
-- The column was introduced free-form/nullable; lock it to the two valid
-- states and make it NOT NULL (existing rows already carry the 'pending'
-- default). Guarded so the migration is safe to re-run.

UPDATE "public"."order_insurance_policies"
  SET "inspection_status" = 'pending'
  WHERE "inspection_status" IS NULL;

ALTER TABLE "public"."order_insurance_policies"
  ALTER COLUMN "inspection_status" SET DEFAULT 'pending',
  ALTER COLUMN "inspection_status" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "pg_constraint"
    WHERE "conname" = 'order_insurance_policies_inspection_status_check'
  ) THEN
    ALTER TABLE "public"."order_insurance_policies"
      ADD CONSTRAINT "order_insurance_policies_inspection_status_check"
      CHECK ("inspection_status" IN ('pending', 'completed'));
  END IF;
END $$;
