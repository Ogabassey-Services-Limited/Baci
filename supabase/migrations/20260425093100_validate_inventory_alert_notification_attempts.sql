ALTER TABLE public.inventory_alerts
  VALIDATE CONSTRAINT inventory_alerts_notification_attempts_nonnegative;

COMMENT ON CONSTRAINT inventory_alerts_notification_attempts_nonnegative ON public.inventory_alerts IS
  'Ensures inventory alert notification retry counts remain non-negative; validated separately after adding the NOT VALID constraint to reduce deployment lock impact.';
