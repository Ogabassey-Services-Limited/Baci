-- Store-settings optimistic concurrency compares the loaded merchant timestamp
-- exactly. Historical rows were permitted to hold a NULL token, making them
-- impossible to update through the guarded RPC. Repair those rows before
-- enforcing the invariant for every future merchant.

UPDATE public.merchants
   SET updated_at = COALESCE(updated_at, created_at, pg_catalog.now())
 WHERE updated_at IS NULL;

ALTER TABLE public.merchants
  ALTER COLUMN updated_at SET DEFAULT pg_catalog.now(),
  ALTER COLUMN updated_at SET NOT NULL;

COMMENT ON COLUMN public.merchants.updated_at IS
  'Non-null optimistic-concurrency token for merchant settings and other merchant updates.';
