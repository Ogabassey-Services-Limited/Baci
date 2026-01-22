-- Add shipping columns to orders table
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "shipping_provider" text;
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "tracking_number" text;

COMMENT ON COLUMN "public"."orders"."shipping_provider" IS 'The code of the shipping provider (e.g. TOPSHIP, GIGL) used for this order';
COMMENT ON COLUMN "public"."orders"."tracking_number" IS 'Tracking number for the shipment associated with this order';
