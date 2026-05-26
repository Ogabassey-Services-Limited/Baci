# Admin Branch System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILLS: Use `superpowers:executing-plans`, `superpowers:test-driven-development`, and `superpowers:using-git-worktrees`. Do **not** use subagents for this implementation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make admin branches real merchant locations that can be created, edited, deactivated, selected, and used to scope supported operational workflows without pretending merchant-wide data is branch-specific.

**Architecture:** Branches remain merchant-owned rows in Supabase, but the admin app gets an explicit branch scope: `all` or a concrete branch id. Branches are an operational/reporting scope in this plan, not a hard staff authorization boundary; staff branch restrictions are isolated into a later phase because they require a separate access model. New append-only migrations add missing `branch_id` links to operational rows, allow `settings.edit` staff to insert/update branches through RLS, route deactivation through a permission-checked RPC, and add database triggers so branch writes, audit rows, merchant immutability, manager ownership, last-active-branch protection, and virtual-terminal cleanup commit atomically. Mobile hooks consume one shared branch scope instead of each screen guessing. The UI shows an "All locations" option so branch selection is deliberate and not confused with environment/git branches.

**Tech Stack:** Supabase/PostgreSQL/RLS, Next.js App Router API routes, Expo React Native, TanStack Query, MMKV, Zod, Vitest/React Testing Library, pnpm/Turborepo/Biome.

---

## Execution Constraints

- Implement from an isolated git worktree created from `origin/main`, not from the primary checkout. Use `.worktrees/<branch-name>` or another repo-local worktree path created from `origin/main` before coding.
- Do not use subagents. Execute this plan inline in the isolated worktree.
- Use TDD for every runtime behavior change: write or update the failing test first, run it and confirm the expected failure, implement the smallest change that passes, rerun the targeted test, then refactor while tests stay green.
- If a task lists implementation before tests, the TDD rule overrides the local order: write the task's tests first.
- For SQL migration behavior, write the migration verification query/test first when the repo has a harness. If no harness exists, write the verification note before writing application code and run the migration lint/check command immediately after the SQL change.

## TDD Gates

Before doing the implementation step in any runtime task below, complete the task-local red test first:
- Task 1: write the migration verification query/note for branch RLS, merchant immutability, manager ownership, concurrent last-active-branch protection, audit behavior, terminal cleanup, and branch-id integrity before writing the migration SQL.
- Task 2: write the branch route tests for auth, permission, validation, soft deactivation, no `.delete()`, no route-level terminal cleanup, and last-branch conflict before changing the route handlers.
- Task 3: add the order-contract assertion before changing the shared column strings.
- Task 4: add the branch-scope hook tests before implementing the hook.
- Task 5: add `branch-api.ts`, `useBranches`, and `useStaffAccounts` tests before implementing mobile branch writes.
- Task 6: add the branch switcher accessibility and deactivation tests before rebuilding the UI.
- Task 7: add branch-scope query tests, including explicit "does not filter customers or analytics_events by branch_id" assertions, before changing dashboard/orders/expenses hooks.
- Task 8: add analytics/inventory semantic tests before changing the hooks.
- Task 9: add web analytics API branch-validation tests before changing the API/query builders.
- Task 10: add staff accounts branch-management tests before changing the screen/cards.
- Task 11: add backfill decision tests before writing the apply logic.
- Task 12: add merchant branch audit script tests before writing the script.
- Task 14: run targeted tests before manual QA and project-wide checks.

---

## File Map

- Create `supabase/migrations/20260430120000_branch_scope_foundation.sql`: append-only DB migration for branch-scoped orders, inventory foundations, expenses, branch insert/update RLS, permission-checked deactivation RPC, atomic audit/merchant-immutability/manager-ownership/active-default/last-active-branch/terminal-cleanup triggers, indexes, and RLS-safe constraints.
- Create `apps/web/src/schemas/branches.ts`: shared Zod schemas for `/api/branches`.
- Create `apps/web/src/schemas/branches.test.ts`: schema validation coverage for branch create/update/default/deactivation payloads.
- Modify `apps/web/src/app/api/branches/route.ts`: use exported schemas, explicit columns, active filtering, error handling, no `select('*')`.
- Modify `apps/web/src/app/api/branches/[id]/route.ts`: use exported schemas, explicit columns, permission-checked deactivation RPC, no `select('*')`.
- Modify `packages/shared/src/contracts/orders.ts`: include `branch_id` in mobile/web order selects.
- Create `apps/mobile-admin/schemas/branch.ts`: mobile branch schemas and `BranchScope` types.
- Create `apps/mobile-admin/hooks/useBranchScope.ts`: single source of truth for active branch scope, persisted per merchant/user.
- Create `apps/mobile-admin/lib/branch-api.ts`: authenticated mobile API client wrapper for branch writes; mobile must not write branch mutations directly to Supabase.
- Modify `apps/mobile-admin/hooks/useBranches.ts`: move validation to schema file, read via Supabase with explicit columns, and write through `branch-api.ts`.
- Modify `apps/mobile-admin/hooks/useStaffAccounts.ts`: remove the direct `branches` insert path and call `branch-api.ts` for branch creation from staff-account screens.
- Split `apps/mobile-admin/components/dashboard/BranchSwitcher.tsx` into smaller files under `apps/mobile-admin/components/branches/`: switcher, pill, create sheet, edit sheet.
- Modify `apps/mobile-admin/components/dashboard/index.ts`: re-export the new branch switcher.
- Modify `apps/mobile-admin/hooks/useDashboardStats.ts`, `useOrders.ts`, `useOrderCounts.ts`, `useAnalyticsOverview.ts`, `useProducts.ts`, `submitNewOrder.ts`: accept and apply branch scope where the underlying data is branch-aware.
- Modify `apps/mobile-admin/app/(admin)/(tabs)/index.tsx`, `orders.tsx`, `products.tsx`, `inventory.tsx`, `staff-accounts.tsx`, `expenses/index.tsx`, `expenses/new.tsx`, `expenses/[id].tsx`: wire scope, CRUD UI, and merchant-wide labels for unsupported metrics.
- Add/modify colocated tests for every touched runtime file.

---

## Product And Security Decisions

- Branch scope is **not** an authorization boundary in this rollout. It filters operational views and stamps new operational rows. Owners and permitted staff still access merchant-wide data according to existing staff permissions.
- Staff-to-branch restrictions are deferred until a `staff_branch_assignments` or equivalent model exists. Do not fake this with client-side filtering.
- Branch create/update/deactivate are sensitive merchant settings changes. Create/update must go through the branch API, deactivation must go through the permission-checked RPC, and all branch mutations must be audited by the database trigger in the same transaction. Audit insertion failures must fail the branch mutation instead of being silently ignored.
- A merchant with active branches must have exactly one active default for new branch mutations after this migration. The migration promotes the only active branch where that is deterministic; merchants that already have multiple active branches and no default must explicitly choose a default before future branch mutations proceed.
- Branch writes require a real user actor. Do not use service-role-only branch maintenance scripts in this rollout; those writes intentionally fail audit because `audit_logs.user_id` is non-null and references `auth.users`.
- Legacy rows with `branch_id = null` remain visible only in `All locations` unless a reliable backfill source exists.
- Inventory value/stock counts remain merchant-wide in this rollout unless rows have real branch allocation data. Do not derive branch inventory from product-level `stock_quantity`.
- Expenses remain owner-only in this rollout because the existing staff permission model does not define an `expenses` permission. Branch-scoped expense UI is for merchant owners only until a future staff expense permission is introduced.

## Rollout Phases

1. **Phase 1: Branch Hygiene And CRUD** - DB foundations, hardened APIs, mobile branch management, and verification that inactive test/demo branches stay hidden.
2. **Phase 2: Branch-Scoped Orders, Expenses, And Dashboard** - order contracts, dashboard stats, order lists/counts, manual order stamping, and expense branch stamping/filtering.
3. **Phase 3: Analytics And Inventory Semantics** - branch filters for order-based analytics APIs; inventory remains merchant-wide with explicit labels until a branch inventory allocation model exists.
4. **Phase 4: Staff Branch Authorization** - only if product requires branch-level staff isolation; this needs a new data model and RLS review.

---

### Task 1: Database Branch Scope Foundation

**Files:**
- Create: `supabase/migrations/20260430120000_branch_scope_foundation.sql`

- [ ] **Step 1: Write the failing migration verification first**

Create the migration verification note or SQL test query before writing the migration. It must initially fail because the new `branch_id` columns, branch mutation triggers, and last-active-branch guard do not exist yet.

Expected: FAIL in the SQL harness if one exists, or a written verification note that records the missing columns/triggers before the migration is added.

- [ ] **Step 2: Write the append-only migration**

```sql
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
      SELECT id FROM public.merchants WHERE user_id = (SELECT auth.uid())
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
      SELECT id FROM public.merchants WHERE user_id = (SELECT auth.uid())
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
      SELECT id FROM public.merchants WHERE user_id = (SELECT auth.uid())
    )
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'settings',
      'edit'
    )
  );

DROP POLICY IF EXISTS "Merchants can delete own branches" ON public.branches;
-- Intentionally do not recreate a DELETE policy.
-- Branch deactivation is an audited UPDATE to active = false.
-- Direct hard deletes must remain denied to authenticated users.

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
CREATE POLICY "Merchants can manage their own expenses"
  ON public.expenses
  TO authenticated
  USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = (SELECT auth.uid())
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
BEGIN
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
      SELECT id FROM public.merchants WHERE user_id = v_actor_id
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

  -- Serialize active-branch changes per merchant before counting.
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
      USING ERRCODE = '23514';
  END IF;

  IF v_branch.is_default IS TRUE THEN
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
```

- [ ] **Step 3: Run the branch data integrity verification**

Create a migration verification note or SQL test query that proves:
- staff with `settings.edit` can insert and update branch rows through RLS, and can soft-deactivate branches only through `deactivate_branch(uuid)`
- direct authenticated `DELETE FROM public.branches` is denied for owners and staff because branch removal is soft-delete-only in this rollout
- branch insert/update/deactivate writes an `audit_logs` row in the same transaction
- a forced audit insert failure aborts the branch mutation
- service-role-only branch writes without `auth.uid()` fail with `Branch audit actor is required`
- updating `branches.merchant_id` is rejected, including direct authenticated Supabase updates
- assigning `branches.manager_id` to a staff member from another merchant is rejected on insert and update
- direct authenticated `UPDATE branches SET active = false` is rejected; branch active-state changes must use `deactivate_branch(uuid)`
- deactivating the only active branch through `deactivate_branch(uuid)` is rejected by the database
- setting `is_default = true` on an inactive branch is rejected by the `branches_default_requires_active` constraint
- setting the only active default branch to `is_default = false` is rejected unless another active branch becomes default in the same statement/transaction
- inserting the first active branch without `is_default = true` is rejected so new branch mutations cannot create active branches with no default
- deactivating the active default branch through `deactivate_branch(uuid)` promotes the oldest remaining active branch as default in the same transaction
- concurrent `deactivate_branch(uuid)` calls for the last two active branches serialize on the merchant advisory lock and leave at least one active branch
- deactivating a branch unassigns matching `virtual_terminals.branch_id` in the same transaction
- a forced terminal cleanup failure aborts the branch deactivation
- `ensure_single_default_branch`, `ensure_branch_matches_merchant`, `prevent_branch_merchant_change`, `ensure_branch_manager_matches_merchant`, `audit_branch_mutation`, `reject_direct_branch_active_update`, `unassign_branch_terminals_on_deactivation`, and `enforce_active_default_branch` have `EXECUTE` revoked from `PUBLIC`, `anon`, and `authenticated`
- `deactivate_branch(uuid)` has `EXECUTE` revoked from `PUBLIC` and `anon`, and granted only to `authenticated`
- two active default branches cannot exist for one merchant
- after deactivating a default branch, the affected merchant still has exactly one active default branch
- a merchant with exactly one active branch gets that branch marked as default
- a merchant with multiple active branches and no default does not get an automatic surprise branch; app flows must require an explicit merchant choice
- cross-merchant branch ids are rejected on `orders`, `variant_inventory`, and `expenses`
- inactive branch ids are rejected on insert and on branch reassignment
- historical rows can keep an inactive branch reference when the branch id is not changed
- `orders.branch_id`, `variant_inventory.branch_id`, and `expenses.branch_id` accept `NULL`
- owner users can manage `expenses`, while staff expense access remains denied until a future expense permission exists

- [ ] **Step 4: Run DB lint locally if available**

Run: `pnpm --filter web supabase:lint`

Expected: command either passes, or package has no such script. If no script exists, record that in the verification notes and continue.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260430120000_branch_scope_foundation.sql
git commit -m "feat(db): add branch scope foundation"
```

---

### Task 2: Web Branch API Hardening

**Files:**
- Create: `apps/web/src/schemas/branches.ts`
- Create: `apps/web/src/schemas/branches.test.ts`
- Modify: `apps/web/src/app/api/branches/route.ts`
- Modify: `apps/web/src/app/api/branches/[id]/route.ts`
- Test: `apps/web/src/app/api/branches/route.test.ts`
- Test: `apps/web/src/app/api/branches/[id]/route.test.ts`
- Test: `apps/web/src/schemas/branches.test.ts`

- [ ] **Step 1: Write failing branch route and schema tests**

Before changing schemas or route handlers, add tests that cover branch create/update/default/deactivation schema validation, invalid bodies, mobile Bearer auth, `settings.edit`, soft deactivation, last-active-branch conflicts, no Supabase `.delete()`, no route-level `virtual_terminals` updates, and no route-level audit helper. Run the targeted branch schema and route tests and confirm they fail for the missing behavior.

Tests must assert:
- returns `401` before database work when unauthenticated
- accepts mobile `Authorization: Bearer <token>` auth via `authenticateApiRequest`
- allows staff with `settings.edit` to create, update, and deactivate branches
- returns `403` for staff without `settings.edit`
- rejects invalid create/update body with `400`
- rejects `active` in PUT bodies; active-state changes only happen through DELETE/RPC
- lists only current merchant branches
- creates first branch as default when requested
- creates the first active branch as default even when `isDefault` is omitted
- rejects a `managerId` from another merchant with `400`
- surfaces database manager ownership rejection from direct Supabase write errors without claiming success
- soft-deactivates through `deactivate_branch(uuid)`, which sets `active = false` inside the database transaction
- deactivating the current default branch leaves exactly one remaining active branch marked `is_default = true`
- rejects setting an inactive branch as default and surfaces `Default branch must be active.`
- never calls Supabase `.delete()` for branch removal
- calls `rpc('deactivate_branch', { p_branch_id: id })` for deactivation
- never updates `branches.active` directly from the route
- relies on the database trigger for virtual-terminal cleanup instead of updating `virtual_terminals` in the route
- returns `409` with `Create another branch before deactivating this one.` when the database rejects last-active-branch deactivation
- returns `500` on Supabase write errors, including audit trigger failures
- does not import or call a route-level audit helper
- never uses wildcard selects

Run: `pnpm --filter web test apps/web/src/app/api/branches/route.test.ts 'apps/web/src/app/api/branches/[id]/route.test.ts'`

Expected: FAIL because the current routes still use cookie-only auth, wildcard/default selects, direct active updates, and route-level terminal cleanup.

- [ ] **Step 2: Add branch schemas**

```ts
import { z } from 'zod';

export const createBranchSchema = z.object({
  name: z.string().trim().min(2, 'Branch name must be at least 2 characters').max(100),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  managerId: z.string().uuid().nullable().optional(),
  isDefault: z.boolean().optional().default(false),
}).strict();

export const updateBranchSchema = createBranchSchema.partial();
```

- [ ] **Step 3: Rely on database audit trigger**

Do not create a route-level `branch-audit.ts` helper. Branch audit rows are written by `public.audit_branch_mutation()` from Task 1, so branch writes and audit rows are atomic. If the trigger cannot insert into `audit_logs`, the branch mutation fails and the route must return the Supabase error path without claiming success.

- [ ] **Step 4: Enforce settings permission for writes**

Use `authenticateApiRequest(request)` instead of cookie-only auth so the route works for both web sessions and mobile Bearer tokens. After resolving `merchantContext`, convert it with `toUserAccess(merchantContext)` and reject non-owners without `settings.edit`.

```ts
const auth = await authenticateApiRequest(request);
if (!auth.user || !auth.supabase) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const merchantContext = await getMerchantForApiRequest(
  auth.supabase,
  auth.user.id
);
if (!merchantContext) {
  return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
}

const access = toUserAccess(merchantContext);
if (!access.isOwner && !hasPermission(access, 'settings', 'edit')) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

- [ ] **Step 5: Validate branch manager ownership in the API**

The database trigger from Task 1 is the final backstop, but the route should return a clean client error before attempting a branch write. When `managerId` is present and non-null, verify the staff member belongs to the same merchant and is active.

```ts
async function validateBranchManager(
  supabase: SupabaseClient,
  merchantId: string,
  managerId: string | null | undefined
) {
  if (!managerId) {
    return true;
  }

  const { data, error } = await supabase
    .from('staff_members')
    .select('id')
    .eq('id', managerId)
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate branch manager: ${error.message}`);
  }

  return Boolean(data);
}
```

For create/update, return `400` with `{ error: 'Branch manager must belong to this merchant.' }` when validation returns false. Still keep the database trigger because direct authenticated Supabase updates can bypass the API.

- [ ] **Step 6: Update route handlers to use explicit columns**

Use this column list in both route files:

```ts
const BRANCH_COLUMNS =
  'id, merchant_id, name, address, city, state, phone, manager_id, is_default, active, created_at, updated_at' as const;
```

Replace every branch `.select()` or `select('*')` with `.select(BRANCH_COLUMNS)`. GET `/api/branches` should return active branches by default with `.eq('active', true)`.

Do not insert audit logs in the route. The database trigger handles `branch.create`, `branch.update`, and `branch.deactivate` in the same transaction as the branch write.

The route-level `DELETE` handler remains an API soft-deactivation command. It must call `supabase.rpc('deactivate_branch', { p_branch_id: id })`; it must not call Supabase `.delete()` on `branches`, and it must not update `branches.active` directly.

Do not run route-level `virtual_terminals` cleanup after deactivation. The database trigger from Task 1 unassigns matching terminals in the same transaction as the branch update. If terminal cleanup fails, the branch update must fail and the route must return the Supabase error path.

If the database rejects deactivation with `Cannot deactivate the only active branch`, return `409` with `{ error: 'Create another branch before deactivating this one.' }`. If direct active-state update is rejected with `Use deactivate_branch to change branch active state`, treat it as a route bug and return `500`. Do not rely only on mobile UI guards; `deactivate_branch(uuid)` is the source of truth for API and direct authenticated RPC calls.

When `isDefault: true` is sent for an inactive branch, the route must not claim success. Prefer returning `404` by scoping mutable branch lookups to active branches. If the database constraint still rejects the write, return `400` with `{ error: 'Default branch must be active.' }`.

When creating a branch, make it default if either the request passes `isDefault: true` or the merchant currently has zero active branches:

```ts
const { count: activeBranchCount, error: countError } = await supabase
  .from('branches')
  .select('id', { count: 'exact', head: true })
  .eq('merchant_id', merchantId)
  .eq('active', true);

if (countError) {
  return NextResponse.json(
    { error: 'Failed to inspect branches' },
    { status: 500 }
  );
}

const shouldBeDefault = parsed.data.isDefault || (activeBranchCount ?? 0) === 0;
```

- [ ] **Step 7: Run tests**

Run: `pnpm --filter web test apps/web/src/app/api/branches/route.test.ts 'apps/web/src/app/api/branches/[id]/route.test.ts'`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/schemas/branches.ts apps/web/src/schemas/branches.test.ts apps/web/src/app/api/branches/route.ts 'apps/web/src/app/api/branches/[id]/route.ts' apps/web/src/app/api/branches/route.test.ts 'apps/web/src/app/api/branches/[id]/route.test.ts'
git commit -m "fix(web): harden branch api routes"
```

---

### Task 3: Shared Order Contract

**Files:**
- Modify: `packages/shared/src/contracts/orders.ts`
- Modify: `packages/shared/src/contracts/orders.test.ts`

- [ ] **Step 1: Write the failing order contract assertion**

Add this assertion before changing the shared column strings:

```ts
it('includes branch_id for branch-scoped admin views', () => {
  expect(WEB_ORDER_COLUMNS).toContain('branch_id');
  expect(MOBILE_ADMIN_ORDER_COLUMNS).toContain('branch_id');
});
```

Run: `pnpm --filter @baci/shared test packages/shared/src/contracts/orders.test.ts`

Expected: FAIL because neither order contract includes `branch_id` yet.

- [ ] **Step 2: Add `branch_id` to order contracts**

Update both order column strings so they include `branch_id` immediately after `merchant_id`.

```ts
export const WEB_ORDER_COLUMNS =
  'id, created_at, updated_at, merchant_id, branch_id, customer_id, order_number, customer_name, customer_email, customer_phone, shipping_status, payment_status, total, subtotal, shipping_fee, tax_amount, discount_amount, shipping_address, source, notes, payment_method, ad_tracking, currency, exchange_rate, original_currency, original_total, selected_quote_id, shipping_provider, tracking_number, tracking_token, amount_paid, wallet_amount_used';

export const MOBILE_ADMIN_ORDER_COLUMNS =
  'id, order_number, merchant_id, branch_id, customer_id, customer_name, customer_email, customer_phone, shipping_status, payment_status, total, subtotal, shipping_fee, tax_amount, discount_amount, currency, source, payment_method, notes, is_credit_order, shipping_address, recorded_by_user_id, wallet_amount_used, selected_quote_id, shipping_provider, tracking_number, tracking_token, shipment_id, fulfillment_type, fulfillment_details, self_fulfillment_data, created_at, updated_at';
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @baci/shared test packages/shared/src/contracts/orders.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/contracts/orders.ts packages/shared/src/contracts/orders.test.ts
git commit -m "feat(shared): expose order branch id"
```

---

### Task 4: Mobile Branch Schemas And Scope Hook

**Files:**
- Create: `apps/mobile-admin/schemas/branch.ts`
- Create: `apps/mobile-admin/hooks/useBranchScope.ts`
- Test: `apps/mobile-admin/schemas/branch.test.ts`
- Test: `apps/mobile-admin/hooks/useBranchScope.test.ts`

- [ ] **Step 1: Write failing branch schema and scope tests**

Before creating `apps/mobile-admin/schemas/branch.ts` or `useBranchScope.ts`, add tests that assert:
- `BranchSchema` parses the API branch shape
- `CreateBranchSchema` rejects one-character names
- `BranchMutationPayloadSchema` accepts camelCase `managerId` and `isDefault`
- `useBranchScope` defaults to all branches
- `useBranchScope` persists per merchant id
- `useBranchScope` switches to a concrete branch id
- `useBranchScope` falls back to all when the branch is inactive or missing

Run: `pnpm --filter mobile-admin test apps/mobile-admin/schemas/branch.test.ts apps/mobile-admin/hooks/useBranchScope.test.ts`

Expected: FAIL because `@/schemas/branch` and `useBranchScope` do not exist yet.

- [ ] **Step 2: Create mobile branch schemas**

```ts
import { z } from 'zod';

export const BranchSchema = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  name: z.string().min(1, 'Branch name is required'),
  address: z.string().nullable(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  phone: z.string().nullable(),
  manager_id: z.string().uuid().nullable(),
  is_default: z.boolean(),
  active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
});

export const CreateBranchSchema = z.object({
  name: z.string().trim().min(2, 'Branch name must be at least 2 characters').max(100),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  manager_id: z.string().uuid().nullable().optional(),
  is_default: z.boolean().optional(),
});

export const BranchMutationPayloadSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  managerId: z.string().uuid().nullable().optional(),
  isDefault: z.boolean().optional(),
});

export type Branch = z.infer<typeof BranchSchema>;
export type CreateBranchInput = z.infer<typeof CreateBranchSchema>;
export type BranchMutationPayload = z.infer<typeof BranchMutationPayloadSchema>;
export type BranchScope = { type: 'all' } | { type: 'branch'; branchId: string };
```

- [ ] **Step 3: Implement `useBranchScope`**

Persist by merchant id, not one global key:

```ts
const scopeKey = (merchantId: string) => `branch-scope:${merchantId}`;
```

Expose:

```ts
return {
  scope,
  activeBranchId: scope.type === 'branch' ? scope.branchId : null,
  isAllBranches: scope.type === 'all',
  setAllBranches,
  setBranchScope,
};
```

When the persisted branch id no longer exists in active branches, automatically fall back to `{ type: 'all' }`.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter mobile-admin test apps/mobile-admin/schemas/branch.test.ts apps/mobile-admin/hooks/useBranchScope.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile-admin/schemas/branch.ts apps/mobile-admin/schemas/branch.test.ts apps/mobile-admin/hooks/useBranchScope.ts apps/mobile-admin/hooks/useBranchScope.test.ts
git commit -m "feat(admin): add branch scope state"
```

---

### Task 5: Mobile Branch Data And CRUD

**Files:**
- Create: `apps/mobile-admin/lib/branch-api.ts`
- Modify: `apps/mobile-admin/hooks/useBranches.ts`
- Modify: `apps/mobile-admin/hooks/useStaffAccounts.ts`
- Test: `apps/mobile-admin/lib/branch-api.test.ts`
- Test: `apps/mobile-admin/hooks/useBranches.test.ts`
- Test: `apps/mobile-admin/hooks/useStaffAccounts.test.ts`

- [ ] **Step 1: Write failing mobile branch write tests**

Before creating `branch-api.ts` or changing hooks, add tests that assert:
- branch list filters `active = true`
- create uses `POST /api/branches` and never inserts directly into Supabase
- create maps mobile `is_default` to API `isDefault`
- update uses `PUT /api/branches/:id` and never updates directly in Supabase
- update maps mobile `manager_id` to API `managerId`
- deactivation uses `DELETE /api/branches/:id` and never updates directly in Supabase
- deactivating the only branch throws `Create another branch before deactivating this one.`
- `useStaffAccounts.createBranchMutation` calls `POST /api/branches` through `branch-api.ts`
- `useStaffAccounts.createBranchMutation` never calls `supabase.from('branches').insert`

Run: `pnpm --filter mobile-admin test apps/mobile-admin/lib/branch-api.test.ts apps/mobile-admin/hooks/useBranches.test.ts apps/mobile-admin/hooks/useStaffAccounts.test.ts`

Expected: FAIL because `branch-api.ts` does not exist and branch hooks still write directly to Supabase.

- [ ] **Step 2: Replace inline schemas**

Import from `@/schemas/branch` and delete the local schema definitions.

- [ ] **Step 3: Add authenticated branch API client**

```ts
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import {
  BranchSchema,
  BranchMutationPayloadSchema,
  CreateBranchSchema,
  type Branch,
  type BranchMutationPayload,
  type CreateBranchInput,
} from '@/schemas/branch';

const BranchResponseSchema = z.object({
  success: z.literal(true),
  branch: BranchSchema,
});

function toBranchMutationPayload(
  input: Partial<CreateBranchInput>
): BranchMutationPayload {
  return BranchMutationPayloadSchema.parse({
    name: input.name,
    address: input.address,
    city: input.city,
    state: input.state,
    phone: input.phone,
    managerId: input.manager_id,
    isDefault: input.is_default,
  });
}

export async function createBranch(input: CreateBranchInput): Promise<Branch> {
  const parsed = CreateBranchSchema.parse(input);
  const response = await apiClient('/api/branches', {
    method: 'POST',
    body: JSON.stringify(toBranchMutationPayload(parsed)),
  });
  return BranchResponseSchema.parse(response).branch;
}

export async function updateBranch(
  branchId: string,
  input: Partial<CreateBranchInput>
): Promise<Branch> {
  const parsed = CreateBranchSchema.partial().parse(input);
  const response = await apiClient(`/api/branches/${branchId}`, {
    method: 'PUT',
    body: JSON.stringify(toBranchMutationPayload(parsed)),
  });
  return BranchResponseSchema.parse(response).branch;
}

export async function deactivateBranch(branchId: string): Promise<void> {
  await apiClient(`/api/branches/${branchId}`, { method: 'DELETE' });
}
```

Branch reads can remain direct Supabase reads for cache efficiency; all writes must use this API client.

- [ ] **Step 4: Remove staff-accounts direct branch writes**

In `apps/mobile-admin/hooks/useStaffAccounts.ts`, replace the existing `createBranchMutation` direct Supabase insert with a call to `createBranch` from `@/lib/branch-api`. Keep the existing success alert/callback behavior, but do not call `.from('branches').insert(...)` anywhere in this hook.

```ts
import { createBranch } from '@/lib/branch-api';

const createBranchMutation = useMutation({
  mutationFn: async ({ name, city }: { name: string; city: string }) => {
    return createBranch({
      name,
      city: city || undefined,
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['branches'] });
    callbacks.onBranchCreated();
    Alert.alert('Success', 'Branch created successfully!');
  },
  onError: (error: Error) => {
    Alert.alert('Error', error.message);
  },
});
```

- [ ] **Step 5: Add CRUD mutations**

Expose:
- `useCreateBranch`
- `useUpdateBranch`
- `useDeactivateBranch`

All queries must select:

```ts
const BRANCH_COLUMNS =
  'id, merchant_id, name, address, city, state, phone, manager_id, is_default, active, created_at, updated_at' as const;
```

`useDeactivateBranch` must block deactivation of the only active branch and show a clear error: `Create another branch before deactivating this one.`

- [ ] **Step 6: Run tests**

Run: `pnpm --filter mobile-admin test apps/mobile-admin/lib/branch-api.test.ts apps/mobile-admin/hooks/useBranches.test.ts apps/mobile-admin/hooks/useStaffAccounts.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile-admin/lib/branch-api.ts apps/mobile-admin/lib/branch-api.test.ts apps/mobile-admin/hooks/useBranches.ts apps/mobile-admin/hooks/useBranches.test.ts apps/mobile-admin/hooks/useStaffAccounts.ts apps/mobile-admin/hooks/useStaffAccounts.test.ts
git commit -m "feat(admin): add branch crud hooks"
```

---

### Task 6: Branch Switcher UI

**Files:**
- Create: `apps/mobile-admin/components/branches/BranchSwitcher.tsx`
- Create: `apps/mobile-admin/components/branches/BranchPill.tsx`
- Create: `apps/mobile-admin/components/branches/BranchCreateSheet.tsx`
- Create: `apps/mobile-admin/components/branches/BranchEditSheet.tsx`
- Create: `apps/mobile-admin/components/branches/index.ts`
- Modify: `apps/mobile-admin/components/dashboard/index.ts`
- Replace/remove oversized implementation in `apps/mobile-admin/components/dashboard/BranchSwitcher.tsx`
- Test: `apps/mobile-admin/components/branches/BranchSwitcher.test.tsx`

- [ ] **Step 1: Write failing branch switcher UI tests**

Before rebuilding the UI, add tests that assert:
- no branches shows `All locations` and `Add branch`
- branch list includes branch names from Supabase data
- pressing `All locations` calls `setAllBranches`
- pressing a branch calls `setBranchScope(branch.id)`
- pressing the visible overflow button opens the branch edit sheet
- deactivation action is disabled only for the only active branch

Run: `pnpm --filter mobile-admin test apps/mobile-admin/components/branches/BranchSwitcher.test.tsx`

Expected: FAIL because the new split branch components and visible overflow affordance do not exist yet.

- [ ] **Step 2: Render explicit all-locations scope**

The first pill must be:

```tsx
<BranchPill
  icon="business-outline"
  label="All locations"
  selected={scope.type === 'all'}
  onPress={setAllBranches}
/>
```

Then render active branches:

```tsx
{branches.map((branch) => (
  <BranchPill
    key={branch.id}
    icon="location"
    label={branch.name}
    selected={scope.type === 'branch' && scope.branchId === branch.id}
    onPress={() => setBranchScope(branch.id)}
    onOpenMenu={() => setEditingBranch(branch)}
    menuAccessibilityLabel={`Edit ${branch.name}`}
  />
))}
```

- [ ] **Step 3: Add edit/deactivate affordance**

Each branch pill must include a visible overflow icon button on the right side. Pressing it opens `BranchEditSheet`; long press can be kept as a shortcut, but it must not be the only edit affordance. The overflow button needs `accessibilityRole="button"` and an `accessibilityLabel` like `Edit Lagos main`. The sheet must allow renaming and deactivation. It must not expose raw ids.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter mobile-admin test apps/mobile-admin/components/branches/BranchSwitcher.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile-admin/components/branches apps/mobile-admin/components/dashboard/index.ts apps/mobile-admin/components/dashboard/BranchSwitcher.tsx apps/mobile-admin/components/branches/BranchSwitcher.test.tsx
git commit -m "feat(admin): rebuild branch switcher"
```

---

### Task 7: Branch-Scoped Orders, Expenses, And Dashboard

**Files:**
- Modify: `apps/mobile-admin/hooks/useDashboardStats.ts`
- Modify: `apps/mobile-admin/hooks/useOrders.ts`
- Modify: `apps/mobile-admin/hooks/useOrderCounts.ts`
- Modify: `apps/mobile-admin/hooks/submitNewOrder.ts`
- Modify: `apps/mobile-admin/app/(admin)/expenses/index.tsx`
- Modify: `apps/mobile-admin/app/(admin)/expenses/new.tsx`
- Modify: `apps/mobile-admin/app/(admin)/expenses/[id].tsx`
- Test: matching colocated test files

- [ ] **Step 1: Write failing branch-scope query tests**

Before changing hooks or screens, write tests that prove branch scope filters only branch-aware data. The red tests must fail until `orders`, joined `order_items`, and `expenses` receive branch filters, while `customers`, `analytics_events`, products, and inventory stay merchant-wide.

Tests must assert:
- all scope does not add `.eq('branch_id', ...)`
- branch scope adds `.eq('branch_id', branchId)` only on `orders` and `expenses`
- dashboard item joins use `orders.branch_id`
- dashboard customer queries do not add `.eq('branch_id', ...)`
- dashboard visits queries do not add `.eq('branch_id', ...)`
- branch scope labels merchant-wide customers and visits as all-store metrics
- new manual order payload includes the selected `branch_id`
- all-location new-order flow defaults to the merchant default branch instead of silently assigning a random branch
- expenses list filters by `branch_id` only for branch scope
- new expense payload includes the selected `branch_id`
- unassigned expenses are shown only in `All locations`
- staff users do not get new expense access from this branch-scope rollout

Run: `pnpm --filter mobile-admin test apps/mobile-admin/hooks/useDashboardStats.test.ts apps/mobile-admin/hooks/useOrders.test.ts apps/mobile-admin/hooks/useOrderCounts.test.ts apps/mobile-admin/hooks/submitNewOrder.test.ts apps/mobile-admin/__tests__/admin/expenses.test.tsx`

Expected: FAIL because branch scope is not yet applied to branch-aware order, dashboard, or expense flows.

- [ ] **Step 2: Apply branch filters only to branch-aware data**

Only apply branch scope to tables/joins that actually carry branch context in this rollout: `orders`, `order_items` joined through `orders`, and `expenses`. Do not apply branch filters to `customers`, `analytics_events`, `products`, or product-level inventory queries because those rows are merchant-wide.

For direct `orders` and `expenses` query builders:

```ts
if (scope.type === 'branch') {
  query = query.eq('branch_id', scope.branchId);
}
```

For joined `order_items` queries, include `branch_id` in the joined order projection and filter through the joined order:

```ts
if (scope.type === 'branch') {
  itemsQuery = itemsQuery.eq('orders.branch_id', scope.branchId);
}
```

For merchant-wide dashboard queries, intentionally omit branch filters:

```ts
const customersQuery = supabase
  .from('customers')
  .select('id', { count: 'exact', head: true })
  .eq('merchant_id', merchantId);

const visitsQuery = supabase
  .from('analytics_events')
  .select('id', { count: 'exact', head: true })
  .eq('merchant_id', merchantId)
  .eq('event_type', 'page_view');
```

When branch scope is selected, label these merchant-wide metrics explicitly as `Customers (all store)` and `Visits (all store)`.

- [ ] **Step 3: Include scope in query keys**

Every affected query key must include:

```ts
const branchScopeKey = scope.type === 'branch' ? scope.branchId : 'all';
```

- [ ] **Step 4: Stamp manually created orders**

In the new-order screen, add a required branch selector when more than one active branch exists. Default it to the selected branch when `scope.type === 'branch'`; otherwise default it to the merchant default branch and allow the merchant to change it before submitting. In `submitNewOrder.ts`, include:

```ts
branch_id: selectedBranchId,
```

If there are no active branches, send `null` and let the DB/API keep legacy single-location behavior.

- [ ] **Step 5: Scope and stamp expenses**

Expenses remain owner-only in this rollout. Do not add staff expense RLS, staff expense UI affordances, or API-mediated staff expense access as part of branch scope. If staff expense management is needed later, add an explicit `expenses` permission model and a separate RLS/API plan.

In `expenses/index.tsx`, apply the same branch filter to the expense query:

```ts
if (scope.type === 'branch') {
  query = query.eq('branch_id', scope.branchId);
}
```

In `expenses/new.tsx`, add the same branch selector semantics as manual orders. Default to the selected branch when `scope.type === 'branch'`; otherwise default to the merchant default branch when one exists. Include the selected branch in the insert payload:

```ts
branch_id: selectedBranchId,
```

In `expenses/[id].tsx`, select `branch_id` and display the branch name when present. If `branch_id` is `null`, show the expense only from `All locations` navigation and label the branch field as `Unassigned`.

- [ ] **Step 6: Run tests**

Run: `pnpm --filter mobile-admin test apps/mobile-admin/hooks/useDashboardStats.test.ts apps/mobile-admin/hooks/useOrders.test.ts apps/mobile-admin/hooks/useOrderCounts.test.ts apps/mobile-admin/hooks/submitNewOrder.test.ts apps/mobile-admin/__tests__/admin/expenses.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile-admin/hooks/useDashboardStats.ts apps/mobile-admin/hooks/useOrders.ts apps/mobile-admin/hooks/useOrderCounts.ts apps/mobile-admin/hooks/submitNewOrder.ts 'apps/mobile-admin/app/(admin)/expenses/index.tsx' 'apps/mobile-admin/app/(admin)/expenses/new.tsx' 'apps/mobile-admin/app/(admin)/expenses/[id].tsx' apps/mobile-admin/hooks/*.test.ts apps/mobile-admin/__tests__/admin/expenses.test.tsx
git commit -m "feat(admin): scope orders expenses dashboard by branch"
```

---

### Task 8: Branch-Scoped Analytics And Inventory Semantics

**Files:**
- Modify: `apps/mobile-admin/hooks/useAnalyticsOverview.ts`
- Modify: `apps/mobile-admin/hooks/useAnalyticsDetail.ts`
- Modify: `apps/mobile-admin/hooks/useProducts.ts`
- Test: matching colocated test files

- [ ] **Step 1: Write failing analytics and inventory semantics tests**

Before changing hooks, add tests that assert:
- analytics URL omits `branchId` for all scope
- analytics URL includes `branchId` for branch scope
- branch-scoped dashboard labels visits as merchant-wide, not branch-specific
- inventory RPC is called only with `p_merchant_id`
- branch scope labels inventory as `Inventory (all store)`
- product catalog queries do not add a `branch_id` filter

Run: `pnpm --filter mobile-admin test apps/mobile-admin/hooks/useAnalyticsOverview.test.ts apps/mobile-admin/hooks/useAnalyticsDetail.test.ts apps/mobile-admin/hooks/useProducts.test.ts`

Expected: FAIL because branch scope is not yet threaded into analytics hooks and labels.

- [ ] **Step 2: Pass branch id to analytics API**

Append query param only for branch scope. Branch-scoped analytics must treat order/revenue/order-item metrics as branch-filtered. Customer metrics may be branch-filtered only when they are derived from branch-filtered orders, such as distinct `orders.customer_id`; raw `customers` table counts remain merchant-wide because `customers` has no `branch_id`. Storefront visit metrics remain merchant-wide until `analytics_events.branch_id` exists. The UI label must say `Visits (all store)` when a concrete branch is selected.

```ts
if (scope.type === 'branch') {
  params.set('branchId', scope.branchId);
}
```

- [ ] **Step 3: Keep inventory stats merchant-wide**

Do not replace `get_merchant_inventory_stats` in this rollout. The existing RPC aggregates product-level `stock_quantity`, not branch-allocated stock. When a concrete branch is selected, keep inventory cards merchant-wide and label them explicitly:

```ts
const inventoryScopeLabel =
  scope.type === 'branch' ? 'Inventory (all store)' : 'Inventory';
```

Continue calling the existing RPC with only `p_merchant_id`:

```ts
const { data, error } = await supabase.rpc('get_merchant_inventory_stats', {
  p_merchant_id: merchantId,
});
```

If the product team later requires true branch inventory, create a separate plan that allocates inventory rows to branches, backfills only verified rows, and rewrites stats from branch-aware data. Do not infer branch stock from product-level `stock_quantity`.

- [ ] **Step 4: Keep products query merchant-wide unless product rows gain branch context**

`useProducts.ts` must not add `.eq('branch_id', scope.branchId)` to product queries because products are merchant catalog rows. Product-level analytics/order-derived metrics can be branch-filtered elsewhere, but catalog listing and stock counts remain merchant-wide.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter mobile-admin test apps/mobile-admin/hooks/useAnalyticsOverview.test.ts apps/mobile-admin/hooks/useAnalyticsDetail.test.ts apps/mobile-admin/hooks/useProducts.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile-admin/hooks/useAnalyticsOverview.ts apps/mobile-admin/hooks/useAnalyticsDetail.ts apps/mobile-admin/hooks/useProducts.ts apps/mobile-admin/hooks/*.test.ts
git commit -m "feat(admin): scope analytics and label inventory"
```

---

### Task 9: Web Analytics API Branch Filter

**Files:**
- Modify: `apps/web/src/app/api/analytics/route.ts`
- Modify: `apps/web/src/lib/merchant-analytics-queries.ts`
- Test: matching colocated tests

- [ ] **Step 1: Write failing web analytics branch tests**

Before changing the API route or query builders, add tests that assert:
- invalid branch id returns `400`
- branch from another merchant returns `404`
- branch-scoped analytics adds order filters
- branch-scoped customer analytics is derived from branch-filtered orders or remains labeled merchant-wide; it never filters raw `customers` by `branch_id`
- branch-scoped analytics does not pretend page-view analytics are branch-specific
- all-scope analytics keeps existing merchant-wide behavior

Run: `pnpm --filter web test apps/web/src/app/api/analytics/route.test.ts apps/web/src/lib/merchant-analytics-queries.test.ts`

Expected: FAIL because `branchId` is not validated or threaded into analytics queries yet.

- [ ] **Step 2: Validate `branchId`**

In the API route, parse:

```ts
const branchId = searchParams.get('branchId');
const parsedBranchId = branchId ? z.string().uuid().safeParse(branchId) : null;
```

Return `400` if a provided `branchId` is not a UUID.

- [ ] **Step 3: Verify branch ownership**

Before analytics queries:

```ts
const { data: branch } = await supabase
  .from('branches')
  .select('id')
  .eq('id', branchId)
  .eq('merchant_id', merchantId)
  .eq('active', true)
  .maybeSingle();
```

Return `404` when not found.

- [ ] **Step 4: Thread branch id into query builders**

All order-based analytics queries add `.eq('branch_id', branchId)` when present. Joined order item queries add `.eq('orders.branch_id', branchId)`. Distinct-customer analytics can use branch-filtered orders; raw `customers` queries must not add `branch_id`. Do not filter `analytics_events` by branch in this phase because those rows do not currently carry branch context.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter web test apps/web/src/app/api/analytics/route.test.ts apps/web/src/lib/merchant-analytics-queries.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/analytics/route.ts apps/web/src/lib/merchant-analytics-queries.ts apps/web/src/app/api/analytics/route.test.ts apps/web/src/lib/merchant-analytics-queries.test.ts
git commit -m "feat(web): add branch analytics filter"
```

---

### Task 10: Staff Accounts And Branch Management Screen

**Files:**
- Modify: `apps/mobile-admin/app/(admin)/staff-accounts.tsx`
- Modify: `apps/mobile-admin/components/staff/BranchCard.tsx`
- Test: `apps/mobile-admin/__tests__/admin/staff-accounts.test.tsx`
- Test: `apps/mobile-admin/components/staff/BranchCard.test.tsx`

- [ ] **Step 1: Write failing staff branch-management tests**

Before changing the screen or cards, add tests that assert:
- inactive branches are not shown in default list
- edit button opens edit sheet
- deactivate button calls the mutation for any non-last active branch, including the current default when another active branch exists
- only active branch cannot be deactivated

Run: `pnpm --filter mobile-admin test apps/mobile-admin/__tests__/admin/staff-accounts.test.tsx apps/mobile-admin/components/staff/BranchCard.test.tsx`

Expected: FAIL because branch cards do not expose edit/deactivate actions yet.

- [ ] **Step 2: Add branch actions to cards**

`BranchCard` accepts:

```ts
onEdit: (branchId: string) => void;
onDeactivate: (branchId: string) => void;
canDeactivate: boolean;
```

- [ ] **Step 3: Wire mutations**

The staff accounts screen uses `useUpdateBranch` and `useDeactivateBranch`. After either mutation, invalidate `['branches', merchant.id]` and `['branch-scope', merchant.id]`.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter mobile-admin test apps/mobile-admin/__tests__/admin/staff-accounts.test.tsx apps/mobile-admin/components/staff/BranchCard.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add 'apps/mobile-admin/app/(admin)/staff-accounts.tsx' apps/mobile-admin/components/staff/BranchCard.tsx apps/mobile-admin/__tests__/admin/staff-accounts.test.tsx apps/mobile-admin/components/staff/BranchCard.test.tsx
git commit -m "feat(admin): manage branches from staff accounts"
```

---

### Task 11: Safe Backfill And Null Semantics

**Files:**
- Create: `apps/web/src/scripts/backfill-branch-ids.ts`
- Test: `apps/web/src/scripts/backfill-branch-ids.test.ts`

- [ ] **Step 1: Write failing backfill decision tests**

Before writing the script, add tests that assert:
- one active branch produces `assign_single_active_branch`
- two active branches produces `skip_multiple_active_branches`
- zero active branches produces `skip_no_active_branch`
- dry-run performs no updates
- apply calls only the atomic `backfill_branch_scope_for_single_active_branch` RPC
- RPC errors and invalid update-count payloads fail closed

Run: `pnpm --filter web test apps/web/src/scripts/backfill-branch-ids.test.ts`

Expected: FAIL because `backfill-branch-ids.ts` does not exist yet.

- [ ] **Step 2: Add dry-run backfill script**

The script must default to dry-run and only update rows for merchants with exactly one active branch. It must never assign rows for merchants with two or more active branches.

```ts
type BackfillDecision =
  | { action: 'assign_single_active_branch'; merchantId: string; branchId: string }
  | { action: 'skip_multiple_active_branches'; merchantId: string; activeBranchCount: number }
  | { action: 'skip_no_active_branch'; merchantId: string };
```

For `--apply`, call the service-role-only `backfill_branch_scope_for_single_active_branch` RPC added by the migration. Do not perform three separate client-side table updates; the orders, variant inventory, and expenses updates must commit atomically or fail together. Do not paste shell-style placeholder variables into a raw SQL query.

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

async function applyBranchBackfill(
  supabase: SupabaseClient,
  decision: Extract<BackfillDecision, { action: 'assign_single_active_branch' }>
) {
  const { data, error } = await supabase.rpc(
    'backfill_branch_scope_for_single_active_branch',
    {
      p_branch_id: decision.branchId,
      p_merchant_id: decision.merchantId,
    }
  );

  if (error) {
    throw new Error(`Failed to backfill branch ids: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error('Branch backfill RPC returned no update counts');
  }

  return {
    orders: row.orders_count,
    variantInventory: row.variant_inventory_count,
    expenses: row.expenses_count,
  };
}
```

- [ ] **Step 3: Run Ogabassey dry run**

Run:

```bash
pnpm --filter web tsx src/scripts/backfill-branch-ids.ts --merchant ogabassey --dry-run
```

Expected: script prints whether Ogabassey is safe to backfill based on active branch count.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/scripts/backfill-branch-ids.ts apps/web/src/scripts/backfill-branch-ids.test.ts
git commit -m "chore(web): add safe branch id backfill"
```

---

### Task 12: Data Cleanup And Operator Verification

**Files:**
- Create: `apps/web/src/scripts/audit-merchant-branches.ts`
- Test: `apps/web/src/scripts/audit-merchant-branches.test.ts`

- [ ] **Step 1: Write failing merchant branch audit test**

Before writing the script, add a test with rows `Lagos main` and inactive `Test Branch`; expect `Lagos main` in `activeBranches`, `Test Branch` in `inactiveFlaggedBranches`, and no active cleanup failure.

Run: `pnpm --filter web test apps/web/src/scripts/audit-merchant-branches.test.ts`

Expected: FAIL because `audit-merchant-branches.ts` does not exist yet.

- [ ] **Step 2: Add dry-run audit script**

Script output must list active branches for a merchant slug/domain and separately flag any active or inactive branch names matching `/test|demo|sample/i`. An inactive match is an operator note; an active match is a cleanup failure that should block rollout.

- [ ] **Step 3: Run against Ogabassey in dry run**

Run:

```bash
pnpm --filter web tsx src/scripts/audit-merchant-branches.ts --merchant ogabassey --dry-run
```

Expected: script prints active branches, confirms `Test Branch` is inactive if it still exists, and exits non-zero only if a test/demo/sample branch is still active.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/scripts/audit-merchant-branches.ts apps/web/src/scripts/audit-merchant-branches.test.ts
git commit -m "chore(web): add merchant branch audit script"
```

---

### Task 13: Future Staff Branch Authorization Guardrails

**Files:**
- Create: `docs/branch-authorization.md`

- [ ] **Step 1: Document non-goals and future model**

Write:

```md
# Branch Authorization Notes

Branches currently provide operational scoping for reporting, orders, expenses, and payment accounts. Inventory remains merchant-wide until a future branch inventory allocation model exists. Branches are not an authorization boundary.

Do not restrict staff to branches with client-side filtering. A future authorization rollout must add a server-enforced model such as `staff_branch_assignments(staff_member_id, branch_id, role, created_at)`, RLS policies, and API checks before hiding or denying merchant data by branch.
```

- [ ] **Step 2: Commit**

```bash
git add docs/branch-authorization.md
git commit -m "docs: define branch authorization boundary"
```

---

### Task 14: Final Quality Gate

**Files:**
- No new source files.

- [ ] **Step 1: Run targeted tests**

```bash
pnpm --filter mobile-admin test apps/mobile-admin/schemas/branch.test.ts apps/mobile-admin/hooks/useBranchScope.test.ts apps/mobile-admin/hooks/useBranches.test.ts apps/mobile-admin/components/branches/BranchSwitcher.test.tsx
pnpm --filter mobile-admin test apps/mobile-admin/lib/branch-api.test.ts apps/mobile-admin/hooks/useStaffAccounts.test.ts
pnpm --filter mobile-admin test apps/mobile-admin/__tests__/admin/expenses.test.tsx
pnpm --filter web test apps/web/src/app/api/branches/route.test.ts 'apps/web/src/app/api/branches/[id]/route.test.ts' apps/web/src/app/api/analytics/route.test.ts
pnpm --filter web test apps/web/src/scripts/backfill-branch-ids.test.ts apps/web/src/scripts/audit-merchant-branches.test.ts
pnpm --filter @baci/shared test packages/shared/src/contracts/orders.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run mandatory project checks**

```bash
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
```

Expected: PASS.

- [ ] **Step 3: Run CodeRabbit review**

```bash
coderabbit review --prompt-only -t uncommitted
```

Expected: no critical or high severity issues remain.

- [ ] **Step 4: Manual QA**

Validate on mobile admin:
- Home shows `All locations`, `Lagos main`, and no inactive `Test Branch`.
- The remaining single active Ogabassey branch, `Lagos main`, is marked default after the migration.
- Selecting `Lagos main` changes dashboard totals, orders, expenses, and order-based analytics to branch-scoped values.
- Selecting `Lagos main` labels inventory as merchant-wide until branch inventory allocation exists.
- Selecting `Lagos main` labels storefront visits as merchant-wide unless `analytics_events.branch_id` has been added in a future rollout.
- Selecting `All locations` restores merchant-wide totals.
- Creating an order while scoped to `Lagos main` stores that branch id.
- Creating an expense while scoped to `Lagos main` stores that branch id.
- Branch edit/deactivate flow works and cannot deactivate the only active branch.
- Deactivating the current default branch while another active branch exists promotes a replacement default in the same transaction.
- Direct authenticated Supabase updates cannot change `branches.active`; deactivation succeeds only through the `deactivate_branch(uuid)` RPC/API path.
- Deactivating a non-default branch unassigns any attached virtual terminals in the same database transaction.
- Direct table hard-delete of a branch is denied; only API soft-deactivation is supported.
- Staff users without `settings.edit` cannot create, update, or deactivate branches.
- Staff users do not gain expense access from this rollout.

- [ ] **Step 5: Commit final adjustments**

```bash
git add .
git commit -m "test: verify branch system rollout"
```

---

## Rollout Notes

- Backfill must not guess branch assignment for merchants with multiple active branches. Only merchants with exactly one active branch are eligible for automatic backfill.
- Rows with uncertain branch ownership keep `branch_id = null`; they appear under `All locations` only.
- For Ogabassey, the known `Test Branch` row was already soft-deactivated via Supabase MCP. Do not recreate it. Verify it remains `active = false`, verify it is not returned by active branch reads, and use the audit script to detect any future `/test|demo|sample/i` branches before manual cleanup.
- Merchants with exactly one active branch should have that branch marked `is_default = true` by the migration. For Ogabassey, verify `Lagos main` is the default branch before branch-scoped order creation goes live.
- Branches are operational/reporting scope in this plan. Do not claim branch-level staff isolation until Phase 4 exists.
- Do not run service-role-only scripts that insert or update branch rows in this rollout. Branch audit requires `auth.uid()` so every branch mutation has a real user actor in `audit_logs.user_id`.
- Do not modify existing migration files. Every database change above is append-only.
- Do not modify `apps/web/src/proxy.ts`.

## Rollback And Recovery Runbook

- If mobile/web rollout must be paused after the migration lands, disable the branch CRUD entry points and branch-scoped UI via the app release/feature flag path rather than editing or reverting the append-only migration.
- If backfill output is wrong before `--apply`, do not run apply. Fix branch data first, rerun the dry run, and require exactly one active branch before automatic backfill.
- If `--apply` fails, treat the result as no-op unless the JSON output includes update counts. The RPC is atomic, so partial orders/variant-inventory/expenses assignment is not expected; verify with count queries for `branch_id IS NULL`.
- If a branch is deactivated accidentally, reactivate it only through a user-authenticated, audited branch update path and verify the merchant still has exactly one active default.
- If branch-scoped reads cause production issues, keep writes stamped but temporarily present `All locations` only in mobile admin while investigating. Do not hard-delete branch rows or clear historical `branch_id` values as a rollback shortcut.
