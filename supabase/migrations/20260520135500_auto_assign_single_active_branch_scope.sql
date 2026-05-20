CREATE OR REPLACE FUNCTION public.ensure_branch_matches_merchant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_valid boolean;
  v_single_active_branch_id uuid;
BEGIN
  IF NEW.branch_id IS NULL THEN
    SELECT active_branch.branch_id
    INTO v_single_active_branch_id
    FROM (
      SELECT
        b.id AS branch_id,
        count(*) OVER () AS active_branch_count
      FROM public.branches b
      WHERE b.merchant_id = NEW.merchant_id
        AND b.active = true
    ) active_branch
    WHERE active_branch.active_branch_count = 1
    LIMIT 1;

    IF v_single_active_branch_id IS NOT NULL THEN
      NEW.branch_id := v_single_active_branch_id;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
    OR (
      TG_OP = 'UPDATE'
      AND NEW.branch_id IS DISTINCT FROM OLD.branch_id
    )
  THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.branches b
      WHERE b.id = NEW.branch_id
        AND b.merchant_id = NEW.merchant_id
        AND b.active = true
    ) INTO v_branch_valid;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.branches b
      WHERE b.id = NEW.branch_id
        AND b.merchant_id = NEW.merchant_id
    ) INTO v_branch_valid;
  END IF;

  IF v_branch_valid IS NOT TRUE THEN
    RAISE EXCEPTION 'Invalid branch assignment'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_branch_matches_merchant() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_branch_matches_merchant() FROM anon;
REVOKE ALL ON FUNCTION public.ensure_branch_matches_merchant() FROM authenticated;
