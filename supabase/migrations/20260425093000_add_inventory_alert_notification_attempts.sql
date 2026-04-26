ALTER TABLE public.inventory_alerts
  ADD COLUMN IF NOT EXISTS notification_attempts integer DEFAULT 0 NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventory_alerts_notification_attempts_nonnegative'
      AND conrelid = 'public.inventory_alerts'::regclass
  ) THEN
    ALTER TABLE public.inventory_alerts
      ADD CONSTRAINT inventory_alerts_notification_attempts_nonnegative
      CHECK (notification_attempts >= 0) NOT VALID;
  END IF;
END $$;
