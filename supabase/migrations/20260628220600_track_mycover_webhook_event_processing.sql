-- Track in-flight versus completed MyCover webhook event claims.
-- Existing rows were inserted only after successful processing on older code, so
-- backfill them as processed while new claims start in `processing`.
ALTER TABLE "public"."mycover_webhook_events"
  ADD COLUMN IF NOT EXISTS "processing_status" "text" NOT NULL DEFAULT 'processed',
  ADD COLUMN IF NOT EXISTS "processed_at" timestamp with time zone;

UPDATE "public"."mycover_webhook_events"
SET "processed_at" = COALESCE("processed_at", "received_at")
WHERE "processing_status" = 'processed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mycover_webhook_events_processing_status_check'
      AND conrelid = 'public.mycover_webhook_events'::regclass
  ) THEN
    ALTER TABLE "public"."mycover_webhook_events"
      ADD CONSTRAINT "mycover_webhook_events_processing_status_check"
      CHECK ("processing_status" IN ('processing', 'processed'));
  END IF;
END $$;
