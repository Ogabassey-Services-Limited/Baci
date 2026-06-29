-- New mycover_webhook_events rows must start in-flight ('processing'), not
-- already-done ('processed'). The original ADD COLUMN used DEFAULT 'processed'
-- only to backfill legacy rows (which were inserted post-success on older code).
-- Now that the backfill is complete, restore the intended default so a future
-- insert that omits processing_status is correctly treated as in-flight.
ALTER TABLE "public"."mycover_webhook_events"
  ALTER COLUMN "processing_status" SET DEFAULT 'processing';
