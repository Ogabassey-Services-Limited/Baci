-- Branch scope foundation for admin operational locations.
-- Append-only migration: adds branch links, hardens branch mutation paths, and
-- keeps branch audit/default/terminal cleanup behavior inside the database.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.variant_inventory
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

WITH ranked_defaults AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY merchant_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.branches
  WHERE active = true
    AND is_default = true
)
UPDATE public.branches b
SET is_default = false,
    updated_at = now()
FROM ranked_defaults r
WHERE b.id = r.id
  AND r.rn > 1;

UPDATE public.branches
SET is_default = false,
    updated_at = now()
WHERE active IS NOT TRUE
  AND is_default IS TRUE;

WITH active_branches AS (
  SELECT
    id,
    merchant_id,
    count(*) OVER (PARTITION BY merchant_id) AS active_count,
    row_number() OVER (
      PARTITION BY merchant_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.branches
  WHERE active = true
)
UPDATE public.branches b
SET is_default = true,
    updated_at = now()
FROM active_branches ab
WHERE b.id = ab.id
  AND ab.active_count = 1
  AND ab.rn = 1
  AND b.is_default IS DISTINCT FROM true;

CREATE INDEX IF NOT EXISTS idx_orders_merchant_branch_created
  ON public.orders (merchant_id, branch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_variant_inventory_merchant_branch
  ON public.variant_inventory (merchant_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_expenses_merchant_branch_created
  ON public.expenses (merchant_id, branch_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_one_active_default_per_merchant
  ON public.branches (merchant_id)
  WHERE is_default = true AND active = true;

CREATE OR REPLACE FUNCTION public.ensure_single_default_branch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    PERFORM set_config('app.branch_default_switch', 'on', true);

    UPDATE public.branches
    SET is_default = false,
        updated_at = now()
    WHERE merchant_id = NEW.merchant_id
      AND id <> NEW.id
      AND is_default = true;

    PERFORM set_config('app.branch_default_switch', 'off', true);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_single_default_branch() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_single_default_branch() FROM anon;
REVOKE ALL ON FUNCTION public.ensure_single_default_branch() FROM authenticated;

DROP TRIGGER IF EXISTS ensure_single_default_branch ON public.branches;
CREATE TRIGGER ensure_single_default_branch
  BEFORE INSERT OR UPDATE OF is_default
  ON public.branches
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION public.ensure_single_default_branch();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branches_default_requires_active'
      AND conrelid = 'public.branches'::regclass
  ) THEN
    ALTER TABLE public.branches
      ADD CONSTRAINT branches_default_requires_active
      CHECK (active IS TRUE OR is_default IS NOT TRUE);
  END IF;
END $$;

DROP POLICY IF EXISTS "Merchants can create branches" ON public.branches;
CREATE POLICY "Merchants can create branches"
  ON public.branches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    merchant_id IN (
      SELECT id
      FROM public.merchants
      WHERE user_id = (SELECT auth.uid())
    )
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'settings',
      'edit'
    )
  );

DROP POLICY IF EXISTS "Merchants can update own branches" ON public.branches;
CREATE POLICY "Merchants can update own branches"
  ON public.branches
  FOR UPDATE
  TO authenticated
  USING (
    merchant_id IN (
      SELECT id
      FROM public.merchants
      WHERE user_id = (SELECT auth.uid())
    )
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'settings',
      'edit'
    )
  )
  WITH CHECK (
    merchant_id IN (
      SELECT id
      FROM public.merchants
      WHERE user_id = (SELECT auth.uid())
    )
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'settings',
      'edit'
    )
  );

DROP POLICY IF EXISTS "Merchants can delete own branches" ON public.branches;

CREATE OR REPLACE FUNCTION public.ensure_branch_matches_merchant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_valid boolean;
BEGIN
  IF NEW.branch_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND NEW.branch_id IS DISTINCT FROM OLD.branch_id
  THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.branches b
      WHERE b.id = NEW.branch_id
        AND b.merchant_id = NEW.merchant_id
        AND b.active = true
    ) INTO v_branch_valid;

    IF v_branch_valid IS NOT TRUE THEN
      RAISE EXCEPTION 'Invalid branch assignment'
        USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
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

DROP TRIGGER IF EXISTS ensure_orders_branch_matches_merchant ON public.orders;
CREATE TRIGGER ensure_orders_branch_matches_merchant
  BEFORE INSERT OR UPDATE OF merchant_id, branch_id
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_branch_matches_merchant();

DROP TRIGGER IF EXISTS ensure_variant_inventory_branch_matches_merchant ON public.variant_inventory;
CREATE TRIGGER ensure_variant_inventory_branch_matches_merchant
  BEFORE INSERT OR UPDATE OF merchant_id, branch_id
  ON public.variant_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_branch_matches_merchant();

DROP TRIGGER IF EXISTS ensure_expenses_branch_matches_merchant ON public.expenses;
CREATE TRIGGER ensure_expenses_branch_matches_merchant
  BEFORE INSERT OR UPDATE OF merchant_id, branch_id
  ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_branch_matches_merchant();

DROP POLICY IF EXISTS "Merchants can manage their own expenses" ON public.expenses;
-- Branch ownership is intentionally enforced by ensure_branch_matches_merchant
-- so historical NULL branch expenses remain visible under merchant-scoped RLS.
CREATE POLICY "Merchants can manage their own expenses"
  ON public.expenses
  TO authenticated
  USING (
    merchant_id IN (
      SELECT id
      FROM public.merchants
      WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    merchant_id IN (
      SELECT id
      FROM public.merchants
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.prevent_branch_merchant_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.merchant_id IS DISTINCT FROM OLD.merchant_id THEN
    RAISE EXCEPTION 'Branch merchant cannot be changed'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_branch_merchant_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_branch_merchant_change() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_branch_merchant_change() FROM authenticated;

DROP TRIGGER IF EXISTS prevent_branch_merchant_change ON public.branches;
CREATE TRIGGER prevent_branch_merchant_change
  BEFORE UPDATE OF merchant_id
  ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_branch_merchant_change();

CREATE OR REPLACE FUNCTION public.ensure_branch_manager_matches_merchant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.manager_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.staff_members sm
    WHERE sm.id = NEW.manager_id
      AND sm.merchant_id = NEW.merchant_id
      AND sm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Branch manager does not belong to merchant'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_branch_manager_matches_merchant() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_branch_manager_matches_merchant() FROM anon;
REVOKE ALL ON FUNCTION public.ensure_branch_manager_matches_merchant() FROM authenticated;

DROP TRIGGER IF EXISTS ensure_branch_manager_matches_merchant ON public.branches;
CREATE TRIGGER ensure_branch_manager_matches_merchant
  BEFORE INSERT OR UPDATE OF merchant_id, manager_id
  ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_branch_manager_matches_merchant();

CREATE OR REPLACE FUNCTION public.audit_branch_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_actor_id uuid := auth.uid();
  v_actor_setting text := nullif(current_setting('app.branch_audit_actor_id', true), '');
BEGIN
  IF v_actor_id IS NULL AND v_actor_setting IS NOT NULL THEN
    BEGIN
      v_actor_id := v_actor_setting::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Branch audit actor setting must be a UUID'
          USING ERRCODE = '22023';
    END;
  END IF;

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Branch audit actor is required'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'branch.create';
  ELSIF TG_OP = 'UPDATE'
    AND OLD.active IS DISTINCT FROM NEW.active
    AND NEW.active = false
  THEN
    v_action := 'branch.deactivate';
  ELSE
    v_action := 'branch.update';
  END IF;

  INSERT INTO public.audit_logs (
    user_id,
    merchant_id,
    action,
    resource_type,
    resource_id,
    changes,
    status
  )
  VALUES (
    v_actor_id,
    NEW.merchant_id,
    v_action,
    'branch',
    NEW.id::text,
    CASE
      WHEN TG_OP = 'INSERT' THEN jsonb_build_object('after', to_jsonb(NEW))
      ELSE jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
    END,
    'success'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_branch_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_branch_mutation() FROM anon;
REVOKE ALL ON FUNCTION public.audit_branch_mutation() FROM authenticated;

DROP TRIGGER IF EXISTS audit_branch_mutation ON public.branches;
CREATE TRIGGER audit_branch_mutation
  AFTER INSERT OR UPDATE
  ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_branch_mutation();

CREATE OR REPLACE FUNCTION public.reject_direct_branch_active_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.active IS DISTINCT FROM NEW.active
    AND current_setting('app.branch_deactivation_rpc', true) IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION 'Use deactivate_branch to change branch active state'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_direct_branch_active_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_direct_branch_active_update() FROM anon;
REVOKE ALL ON FUNCTION public.reject_direct_branch_active_update() FROM authenticated;

DROP TRIGGER IF EXISTS reject_direct_branch_active_update ON public.branches;
CREATE TRIGGER reject_direct_branch_active_update
  BEFORE UPDATE OF active
  ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_direct_branch_active_update();

CREATE OR REPLACE FUNCTION public.deactivate_branch(p_branch_id uuid)
RETURNS public.branches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_branch public.branches%ROWTYPE;
  v_other_active_count integer;
  v_promoted_default_branch_id uuid;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Branch mutation actor is required'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    b.id,
    b.merchant_id,
    b.name,
    b.address,
    b.city,
    b.state,
    b.phone,
    b.manager_id,
    b.is_default,
    b.active,
    b.created_at,
    b.updated_at
  INTO v_branch
  FROM public.branches
  AS b
  WHERE b.id = p_branch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Branch not found'
      USING ERRCODE = '02000';
  END IF;

  IF NOT (
    v_branch.merchant_id IN (
      SELECT id
      FROM public.merchants
      WHERE user_id = v_actor_id
    )
    OR public.check_staff_permission(
      v_actor_id,
      v_branch.merchant_id,
      'settings',
      'edit'
    )
  ) THEN
    RAISE EXCEPTION 'Forbidden'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(
    760001,
    hashtext(v_branch.merchant_id::text)
  );

  SELECT
    b.id,
    b.merchant_id,
    b.name,
    b.address,
    b.city,
    b.state,
    b.phone,
    b.manager_id,
    b.is_default,
    b.active,
    b.created_at,
    b.updated_at
  INTO v_branch
  FROM public.branches
  AS b
  WHERE b.id = p_branch_id
  FOR UPDATE;

  IF v_branch.active IS NOT TRUE THEN
    RETURN v_branch;
  END IF;

  SELECT count(*) INTO v_other_active_count
  FROM public.branches
  WHERE merchant_id = v_branch.merchant_id
    AND id <> v_branch.id
    AND active = true;

  IF v_other_active_count = 0 THEN
    RAISE EXCEPTION 'Cannot deactivate the only active branch'
      USING
        ERRCODE = '23514',
        CONSTRAINT = 'branches_require_active_branch';
  END IF;

  IF v_branch.is_default IS TRUE THEN
    PERFORM set_config('app.branch_default_switch', 'on', true);

    UPDATE public.branches
    SET is_default = true,
        updated_at = now()
    WHERE id = (
      SELECT id
      FROM public.branches
      WHERE merchant_id = v_branch.merchant_id
        AND id <> v_branch.id
        AND active = true
      ORDER BY created_at ASC, id ASC
      LIMIT 1
    )
    RETURNING id INTO v_promoted_default_branch_id;

    IF v_promoted_default_branch_id IS NULL THEN
      RAISE EXCEPTION 'Cannot promote replacement default branch'
        USING ERRCODE = '23514';
    END IF;

    PERFORM set_config('app.branch_default_switch', 'off', true);
  END IF;

  PERFORM set_config('app.branch_deactivation_rpc', 'on', true);

  UPDATE public.branches AS b
  SET active = false,
      is_default = false,
      updated_at = now()
  WHERE b.id = p_branch_id
  RETURNING
    b.id,
    b.merchant_id,
    b.name,
    b.address,
    b.city,
    b.state,
    b.phone,
    b.manager_id,
    b.is_default,
    b.active,
    b.created_at,
    b.updated_at
  INTO v_branch;

  PERFORM set_config('app.branch_deactivation_rpc', 'off', true);

  RETURN v_branch;
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_branch(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deactivate_branch(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.deactivate_branch(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.backfill_branch_scope_for_single_active_branch(
  p_merchant_id uuid,
  p_branch_id uuid
)
RETURNS TABLE (
  orders_count integer,
  variant_inventory_count integer,
  expenses_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_branch_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(760002, hashtext(p_merchant_id::text));

  SELECT count(*) INTO v_active_branch_count
  FROM public.branches
  WHERE merchant_id = p_merchant_id
    AND active = true;

  IF v_active_branch_count <> 1 OR NOT EXISTS (
    SELECT 1
    FROM public.branches
    WHERE id = p_branch_id
      AND merchant_id = p_merchant_id
      AND active = true
  ) THEN
    RAISE EXCEPTION 'Branch backfill requires exactly one active branch for the merchant'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.orders
  SET branch_id = p_branch_id
  WHERE merchant_id = p_merchant_id
    AND branch_id IS NULL;
  GET DIAGNOSTICS orders_count = ROW_COUNT;

  UPDATE public.variant_inventory
  SET branch_id = p_branch_id
  WHERE merchant_id = p_merchant_id
    AND branch_id IS NULL;
  GET DIAGNOSTICS variant_inventory_count = ROW_COUNT;

  UPDATE public.expenses
  SET branch_id = p_branch_id
  WHERE merchant_id = p_merchant_id
    AND branch_id IS NULL;
  GET DIAGNOSTICS expenses_count = ROW_COUNT;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_branch_scope_for_single_active_branch(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_branch_scope_for_single_active_branch(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.backfill_branch_scope_for_single_active_branch(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_branch_scope_for_single_active_branch(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.unassign_branch_terminals_on_deactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.active IS DISTINCT FROM NEW.active AND NEW.active = false THEN
    UPDATE public.virtual_terminals
    SET branch_id = NULL,
        updated_at = now()
    WHERE branch_id = NEW.id
      AND merchant_id = NEW.merchant_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.unassign_branch_terminals_on_deactivation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unassign_branch_terminals_on_deactivation() FROM anon;
REVOKE ALL ON FUNCTION public.unassign_branch_terminals_on_deactivation() FROM authenticated;

DROP TRIGGER IF EXISTS unassign_branch_terminals_on_deactivation ON public.branches;
CREATE TRIGGER unassign_branch_terminals_on_deactivation
  BEFORE UPDATE OF active
  ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.unassign_branch_terminals_on_deactivation();

CREATE OR REPLACE FUNCTION public.enforce_active_default_branch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant_id uuid;
  v_merchant_ids uuid[];
  v_active_count integer;
  v_default_count integer;
BEGIN
  IF current_setting('app.branch_default_switch', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_merchant_ids := ARRAY[NEW.merchant_id];
  ELSE
    v_merchant_ids := ARRAY[NEW.merchant_id, OLD.merchant_id];
  END IF;

  FOR v_merchant_id IN
    SELECT DISTINCT affected_merchant_id
    FROM unnest(v_merchant_ids) AS affected(affected_merchant_id)
    WHERE affected_merchant_id IS NOT NULL
  LOOP
    SELECT
      count(*) FILTER (WHERE active = true),
      count(*) FILTER (WHERE active = true AND is_default = true)
    INTO v_active_count, v_default_count
    FROM public.branches
    WHERE merchant_id = v_merchant_id;

    IF v_active_count > 0 AND v_default_count <> 1 THEN
      RAISE EXCEPTION 'Merchant must have exactly one active default branch'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_active_default_branch() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_active_default_branch() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_active_default_branch() FROM authenticated;

DROP TRIGGER IF EXISTS enforce_active_default_branch ON public.branches;
CREATE CONSTRAINT TRIGGER enforce_active_default_branch
  AFTER INSERT OR UPDATE OF active, is_default, merchant_id
  ON public.branches
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_active_default_branch();
