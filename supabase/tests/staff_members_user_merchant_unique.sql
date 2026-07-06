-- =============================================
-- REGRESSION TEST: staff_members user-merchant uniqueness
--   Ensures mobile onboarding's staff upsert conflict target is backed by a
--   real unique constraint. Without this, PostgREST returns Postgres 42P10:
--   there is no unique or exclusion constraint matching the ON CONFLICT specification.
--
-- USAGE:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/staff_members_user_merchant_unique.sql
-- =============================================

BEGIN;

DO $$
DECLARE
  constraint_definition text;
BEGIN
  SELECT pg_get_constraintdef(oid)
  INTO constraint_definition
  FROM pg_constraint
  WHERE conrelid = 'public.staff_members'::regclass
    AND conname = 'staff_members_user_id_merchant_id_key';

  IF constraint_definition IS NULL THEN
    RAISE EXCEPTION 'staff_members_user_id_merchant_id_key constraint is missing';
  END IF;

  IF constraint_definition NOT ILIKE 'UNIQUE (user_id, merchant_id)' THEN
    RAISE EXCEPTION
      'staff_members_user_id_merchant_id_key must be UNIQUE (user_id, merchant_id), found %',
      constraint_definition;
  END IF;
END $$;

ROLLBACK;
