-- Constrain inspection_status to the documented state machine.
--
-- Historical rows stay NULL because MyCover may already have completed their
-- hosted inspection before this state was stored locally. Future policy rows
-- default to 'pending'. Guarded so the migration is safe to re-run.

ALTER TABLE "public"."order_insurance_policies"
  ALTER COLUMN "inspection_status" SET DEFAULT 'pending',
  ALTER COLUMN "inspection_status" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "pg_constraint"
    WHERE "conname" = 'order_insurance_policies_inspection_status_check'
      AND "conrelid" = 'public.order_insurance_policies'::regclass
  ) THEN
    ALTER TABLE "public"."order_insurance_policies"
      ADD CONSTRAINT "order_insurance_policies_inspection_status_check"
      CHECK (
        "inspection_status" IS NULL
        OR "inspection_status" IN ('pending', 'completed')
      );
  END IF;
END $$;
