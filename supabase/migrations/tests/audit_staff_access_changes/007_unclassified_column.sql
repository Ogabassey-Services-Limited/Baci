DO $test$
DECLARE
  v_unclassified_column_rejected boolean := false;
BEGIN
  ALTER TABLE public.staff_members
    ADD COLUMN audit_staff_access_unclassified_probe text;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    '7e3f2e10-0000-4000-8000-000000000101',
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'role', 'authenticated',
      'sub', '7e3f2e10-0000-4000-8000-000000000101'
    )::text,
    true
  );
  BEGIN
    UPDATE public.staff_members
    SET audit_staff_access_unclassified_probe = 'must-be-classified'
    WHERE id = '7e3f2e10-0000-4000-8000-000000000104';
  EXCEPTION
    WHEN SQLSTATE '55000' THEN
      IF SQLERRM IS DISTINCT FROM 'audit_staff_access_unclassified_column' THEN
        RAISE EXCEPTION 'unclassified staff column raised unexpected error: %', SQLERRM;
      END IF;
      v_unclassified_column_rejected := true;
  END;
  RESET ROLE;

  IF NOT v_unclassified_column_rejected THEN
    RAISE EXCEPTION 'unclassified staff column update was not rejected';
  END IF;
END;
$test$;
