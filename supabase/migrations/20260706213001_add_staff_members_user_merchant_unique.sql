-- Ensure the mobile onboarding owner profile upsert has a real arbiter.
--
-- /api/mobile-onboarding upserts staff_members by (user_id, merchant_id).
-- Supabase/PostgREST can only use ON CONFLICT targets backed by a real
-- unique/exclusion constraint. The existing schema only had unique
-- (merchant_id, email), so the route logged Postgres 42P10 at runtime.
--
-- This is intentionally a full UNIQUE constraint, not a partial unique index:
-- pending invites keep user_id NULL and PostgreSQL UNIQUE constraints allow
-- multiple NULL user_id values, while non-null accepted/onboarded users become
-- one staff profile per merchant. A partial index would not be inferable by the
-- route's plain onConflict target.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.staff_members
    WHERE user_id IS NOT NULL
    GROUP BY user_id, merchant_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot add staff_members(user_id, merchant_id) unique constraint while duplicate accepted staff rows exist';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.staff_members'::regclass
      AND conname = 'staff_members_user_id_merchant_id_key'
  ) THEN
    ALTER TABLE public.staff_members
      ADD CONSTRAINT staff_members_user_id_merchant_id_key
      UNIQUE (user_id, merchant_id);
  END IF;
END
$$;
