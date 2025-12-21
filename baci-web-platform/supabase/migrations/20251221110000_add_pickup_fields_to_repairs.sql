-- Add pickup fields to repairs table
-- This migration adds service_type (dropoff/pickup) and pickup_address fields

ALTER TABLE public.repairs
ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'dropoff',
ADD COLUMN IF NOT EXISTS pickup_address text;

-- Add check constraint for service_type
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'repairs_service_type_check'
    ) THEN
        ALTER TABLE public.repairs
        ADD CONSTRAINT repairs_service_type_check CHECK (service_type IN ('dropoff', 'pickup'));
    END IF;
END $$;

COMMENT ON COLUMN public.repairs.service_type IS 'Whether customer will drop-off the device or request pickup';
COMMENT ON COLUMN public.repairs.pickup_address IS 'Address for device pickup (only if service_type is pickup)';
