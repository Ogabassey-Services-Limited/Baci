DO $test$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.audit_events
    WHERE merchant_id = '9b2a1000-0000-4000-8000-000000000002'
      AND actor_user_id = '9b2a0000-0000-4000-8000-000000000002'
      AND action = 'merchant.identity.create'
      AND source = 'database'
      AND actor_type = 'user'
      AND actor_label = 'database_principal'
  ) THEN
    RAISE EXCEPTION 'database seed merchant was not audit-attributed';
  END IF;
END
$test$;
