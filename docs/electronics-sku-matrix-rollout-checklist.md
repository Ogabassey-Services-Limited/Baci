# Electronics SKU Matrix Rollout Checklist

Last updated: April 15, 2026

This runbook covers the live rollout for the conditioned-variant / `sku_matrix` release on branch `codex/electronics-sku-matrix`.

It assumes a coordinated release:

1. apply DB migrations
2. merge/deploy app code immediately after
3. run smoke tests before merchants begin editing affected products

## Scope

This rollout covers:

- condition-aware variants across web, mobile storefront, and mobile admin
- GMC/feed support for conditioned variants
- `sku_matrix` DB projections and source-of-truth enforcement
- safe legacy backfill for products that can be converted without inventing attribute combinations

This rollout does not complete every future item in [electronics-sku-matrix-plan.md](./electronics-sku-matrix-plan.md). Remaining phase-2 items are listed at the end of this document.

## Migrations

Apply these in this exact order:

1. [20260415103000_add_variant_condition_feed_rpcs.sql](../supabase/migrations/20260415103000_add_variant_condition_feed_rpcs.sql)
2. [20260415110000_prepare_legacy_products_for_sku_matrix.sql](../supabase/migrations/20260415110000_prepare_legacy_products_for_sku_matrix.sql)
3. [20260415122940_repoint_order_item_variant_links_before_dedupe.sql](../supabase/migrations/20260415122940_repoint_order_item_variant_links_before_dedupe.sql)
4. [20260415122950_dedupe_product_variant_keys_before_unique_index.sql](../supabase/migrations/20260415122950_dedupe_product_variant_keys_before_unique_index.sql)
5. [20260415123000_add_sku_matrix_product_projections.sql](../supabase/migrations/20260415123000_add_sku_matrix_product_projections.sql)
6. [20260415150000_mark_legacy_sku_matrix_needs_review.sql](../supabase/migrations/20260415150000_mark_legacy_sku_matrix_needs_review.sql)
7. [20260415191430_dedupe_product_offer_condition_aliases.sql](../supabase/migrations/20260415191430_dedupe_product_offer_condition_aliases.sql)
8. [20260415191440_repoint_order_item_variant_links_before_alias_dedupe.sql](../supabase/migrations/20260415191440_repoint_order_item_variant_links_before_alias_dedupe.sql)
9. [20260415191445_dedupe_product_variant_condition_aliases.sql](../supabase/migrations/20260415191445_dedupe_product_variant_condition_aliases.sql)
10. [20260415191450_prepare_product_condition_constraint_for_open_box.sql](../supabase/migrations/20260415191450_prepare_product_condition_constraint_for_open_box.sql)
11. [20260415191500_canonicalize_product_condition_values.sql](../supabase/migrations/20260415191500_canonicalize_product_condition_values.sql)
12. [20260415191510_validate_product_condition_constraint.sql](../supabase/migrations/20260415191510_validate_product_condition_constraint.sql)

## Release Preconditions

- The deployment to production must include the app changes from `codex/electronics-sku-matrix`.
- Do not apply the migrations and leave old code running for an extended period.
- Be ready to smoke test:
  - one conditioned product in web admin
  - one conditioned product in mobile admin
  - one conditioned product in web storefront
  - one conditioned product in mobile storefront
  - one GMC feed merchant with `gmc_variants_enabled = true`
  - one GMC feed merchant with `gmc_variants_enabled = false`

## Preflight SQL

Run these before applying migrations.

### 1. Duplicate variant-key safety

This must stay at `0 / 0`.

```sql
with variant_keys as (
  select
    pv.product_id,
    (
      jsonb_build_object(
        'condition', nullif(lower(regexp_replace(trim(coalesce(pv.condition, '')), '[\s-]+', '_', 'g')), ''),
        'attributes', coalesce((
          select jsonb_object_agg(
                   lower(attrs.key),
                   lower(regexp_replace(trim(attrs.value), '\s+', ' ', 'g'))
                   order by lower(attrs.key)
                 )
          from jsonb_each_text(coalesce(pv.attributes, '{}'::jsonb)) as attrs(key, value)
          where trim(attrs.value) <> ''
        ), '{}'::jsonb)
      )::text
    ) as variant_key,
    count(*) as row_count
  from public.product_variants pv
  group by
    pv.product_id,
    (
      jsonb_build_object(
        'condition', nullif(lower(regexp_replace(trim(coalesce(pv.condition, '')), '[\s-]+', '_', 'g')), ''),
        'attributes', coalesce((
          select jsonb_object_agg(
                   lower(attrs.key),
                   lower(regexp_replace(trim(attrs.value), '\s+', ' ', 'g'))
                   order by lower(attrs.key)
                 )
          from jsonb_each_text(coalesce(pv.attributes, '{}'::jsonb)) as attrs(key, value)
          where trim(attrs.value) <> ''
        ), '{}'::jsonb)
      )::text
    )
)
select count(*) as duplicate_key_groups,
       coalesce(sum(row_count - 1), 0) as duplicate_rows
from variant_keys
where row_count > 1;
```

Expected on April 15, 2026:

- `duplicate_key_groups = 0`
- `duplicate_rows = 0`

### 2. Conditioned variants already overlapping with offers

This must stay `0`.

```sql
select count(distinct p.id) as products_with_conditioned_variants_and_offers
from public.products p
where exists (
  select 1
  from public.product_variants pv
  where pv.product_id = p.id
    and pv.condition is not null
)
and exists (
  select 1
  from public.product_offers po
  where po.product_id = p.id
);
```

Expected on April 15, 2026:

- `products_with_conditioned_variants_and_offers = 0`

### 3. Backfill candidate counts

```sql
select
  count(distinct p.id) filter (
    where p.condition is not null
      and trim(p.condition) <> ''
      and exists (select 1 from public.product_variants pv where pv.product_id = p.id)
      and not exists (select 1 from public.product_offers po where po.product_id = p.id)
      and not exists (
        select 1 from public.product_variants pv
        where pv.product_id = p.id
          and pv.condition is not null
      )
  ) as parent_condition_plus_variants_only,
  count(distinct p.id) filter (
    where not exists (select 1 from public.product_variants pv where pv.product_id = p.id)
      and exists (select 1 from public.product_offers po where po.product_id = p.id)
      and p.compare_at_price is null
      and not exists (
        select 1
        from public.product_offers po
        where po.product_id = p.id
          and (
            po.compare_at_price is not null
            or po.grade is not null
            or nullif(btrim(coalesce(po.condition_notes, '')), '') is not null
            or coalesce(po.status, 'active') <> 'active'
          )
      )
  ) as simple_offer_products,
  count(distinct p.id) filter (
    where (
      (
        exists (select 1 from public.product_variants pv where pv.product_id = p.id)
        and exists (select 1 from public.product_offers po where po.product_id = p.id)
      )
      or (
        exists (select 1 from public.product_offers po where po.product_id = p.id)
        and (
          p.compare_at_price is not null
          or exists (
            select 1
            from public.product_offers po
            where po.product_id = p.id
              and (
                po.compare_at_price is not null
                or po.grade is not null
                or nullif(btrim(coalesce(po.condition_notes, '')), '') is not null
                or coalesce(po.status, 'active') <> 'active'
              )
          )
        )
      )
    )
  ) as needs_review_candidates
from public.products p;
```

Expected on April 15, 2026:

- `parent_condition_plus_variants_only = 280`
- `simple_offer_products = 126`
- `needs_review_candidates = 126`

If these numbers move slightly before rollout, that is acceptable. The load-bearing checks are the first two safety checks above.

## Migration Window Steps

1. Confirm the production deployment is ready.
2. Run the twelve migrations in order:
   - `20260415103000_add_variant_condition_feed_rpcs.sql`
   - `20260415110000_prepare_legacy_products_for_sku_matrix.sql`
   - `20260415122940_repoint_order_item_variant_links_before_dedupe.sql`
   - `20260415122950_dedupe_product_variant_keys_before_unique_index.sql`
   - `20260415123000_add_sku_matrix_product_projections.sql`
   - `20260415150000_mark_legacy_sku_matrix_needs_review.sql`
   - `20260415191430_dedupe_product_offer_condition_aliases.sql`
   - `20260415191440_repoint_order_item_variant_links_before_alias_dedupe.sql`
   - `20260415191445_dedupe_product_variant_condition_aliases.sql`
   - `20260415191450_prepare_product_condition_constraint_for_open_box.sql`
   - `20260415191500_canonicalize_product_condition_values.sql`
   - `20260415191510_validate_product_condition_constraint.sql`
3. Merge/deploy immediately after the last migration succeeds.
4. Run the post-migration SQL verification below.
5. Run the app smoke tests below.

## Post-Migration SQL Verification

### 1. Product migration state summary

```sql
select variant_model, migration_status, count(*) as product_count
from public.products
group by variant_model, migration_status
order by variant_model, migration_status;
```

Check for:

- `sku_matrix / migrated` should be materially higher than before
- `legacy / needs_review` should contain the unresolved edge cases

### 2. No `product_offers` overlap on `sku_matrix` products

This must be `0`.

```sql
select count(*) as sku_matrix_products_with_offers
from public.products p
where p.variant_model = 'sku_matrix'
  and exists (
    select 1
    from public.product_offers po
    where po.product_id = p.id
  );
```

### 3. Every `sku_matrix` product has a projected default variant

This should be `0`.

```sql
select count(*) as sku_matrix_products_missing_default_variant
from public.products p
where p.variant_model = 'sku_matrix'
  and not exists (
    select 1
    from public.product_variants pv
    where pv.id = p.default_variant_id
      and pv.product_id = p.id
  );
```

### 4. Every `sku_matrix` variant row has a `variant_key`

This should be `0`.

```sql
select count(*) as sku_matrix_variants_missing_variant_key
from public.product_variants pv
join public.products p
  on p.id = pv.product_id
where p.variant_model = 'sku_matrix'
  and (pv.variant_key is null or btrim(pv.variant_key) = '');
```

### 5. Archived offer conversions exist

This confirms the safe offers-only backfill actually ran.

```sql
select archive_reason, count(*) as archived_rows
from public.product_offer_migration_archive
group by archive_reason
order by archive_reason;
```

Look for `converted_simple_offers_to_sku_matrix`.

## App Smoke Tests

### Web storefront

- Open a migrated gadget PDP with condition + attribute combinations.
- Verify exact variant selection changes:
  - price
  - stock state
  - selected condition
  - selected storage/connectivity/size
- Verify attribute-only deep links redirect to the bare family URL.
- Verify `condition + attributes` deep links resolve the right variant.
- Verify out-of-stock exact variant URLs still render the requested display state and disable purchase.

### Mobile storefront

- Open the same conditioned product in the app.
- Verify condition switching and attribute switching resolve the same price/stock as web.
- Verify add-to-cart is blocked only when the chosen exact variant is not purchasable.

### Web admin

- Edit a `sku_matrix` product.
- Change one variant price and stock.
- Save.
- Re-open and confirm:
  - variant condition stayed intact
  - variant price stayed intact
  - parent projected price/condition/stock updated

### Mobile admin

- Open the same `sku_matrix` product.
- Edit one variant row.
- Save.
- Re-open and confirm the variant persisted correctly.

### Feed / GMC

For one merchant with `gmc_variants_enabled = true`:

- feed should emit one row per exact variant
- variant rows should contain variant-level `condition`

For one merchant with `gmc_variants_enabled = false`:

- feed should emit the conservative family-level row derived from `sku_matrix`
- it must not revert to `product_offers` semantics

## Rollback Boundaries

This release is not a clean “rollback everything” deployment. Treat it as a forward-fix rollout with targeted restore options.

### Safe rollback facts

- [20260415103000_add_variant_condition_feed_rpcs.sql](../supabase/migrations/20260415103000_add_variant_condition_feed_rpcs.sql) is additive.
- [20260415110000_prepare_legacy_products_for_sku_matrix.sql](../supabase/migrations/20260415110000_prepare_legacy_products_for_sku_matrix.sql) converts data, but it archives converted `product_offers` rows into `product_offer_migration_archive`.
- [20260415123000_add_sku_matrix_product_projections.sql](../supabase/migrations/20260415123000_add_sku_matrix_product_projections.sql) adds triggers, unique constraints, and behavior changes. Do not partially “undo” this in production unless you are deliberately authoring a forward corrective migration.
- [20260415150000_mark_legacy_sku_matrix_needs_review.sql](../supabase/migrations/20260415150000_mark_legacy_sku_matrix_needs_review.sql) only marks products for manual review. It does not archive or delete data, so any rollback should be a targeted status clear on the specific rows you intentionally want to unmark.

### Practical rollback guidance

- If the issue is app-only, ship a hotfix. Do not try to unwind the projection migration first.
- If a specific offers-only product was converted incorrectly, restore that product from `product_offer_migration_archive` and handle it as a targeted corrective migration.
- Do not bulk restore archived offers unless you are also deliberately undoing the corresponding `sku_matrix` product rows for the same product set.

## Remaining Plan Items That Do Not Need To Block This Migration

- family consolidation and slug redirect handling for legacy split products
- category eligibility gating
- explicit admin “Convert to SKU Matrix” workflow
- cart `reconfirm_required` migration flow
- search aggregation from variant tokens
- richer variant metadata such as grade/condition notes on variant rows
- full ProductGroup / SEO completion from the broader plan

## Release Bar

This rollout is ready when all are true:

- preflight safety checks pass
- the twelve migrations apply cleanly
- post-migration verification checks pass
- web storefront, mobile storefront, web admin, and mobile admin smoke tests pass
- one flag-on and one flag-off GMC feed merchant behave as expected
