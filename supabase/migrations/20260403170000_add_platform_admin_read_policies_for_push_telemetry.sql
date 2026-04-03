DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'push_notification_tickets'
      AND policyname = 'platform_admins_read_push_notification_tickets'
  ) THEN
    CREATE POLICY "platform_admins_read_push_notification_tickets"
      ON public.push_notification_tickets
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.merchants
          WHERE user_id = auth.uid()
            AND is_platform_admin = TRUE
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'push_notification_attempts'
      AND policyname = 'platform_admins_read_push_notification_attempts'
  ) THEN
    CREATE POLICY "platform_admins_read_push_notification_attempts"
      ON public.push_notification_attempts
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.merchants
          WHERE user_id = auth.uid()
            AND is_platform_admin = TRUE
        )
      );
  END IF;
END $$;
