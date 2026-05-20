DROP POLICY IF EXISTS "Staff can view crawler agent observability logs"
  ON public.crawler_logs;

DROP POLICY IF EXISTS "Analytics staff can view crawler agent observability logs"
  ON public.crawler_logs;

CREATE POLICY "Analytics staff can view crawler agent observability logs"
  ON public.crawler_logs
  FOR SELECT
  TO authenticated
  USING (
    public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'analytics',
      'view'
    )
  );
