import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260629084756_restore_mobile_admin_product_rpc_contract.sql'
  ),
  'utf8'
);

const productInsertSql =
  migrationSql.match(
    /INSERT\s+INTO\s+public\.products\s+\([\s\S]*?\)\s+VALUES\s+\([\s\S]*?\)\s+RETURNING\s+id\s+INTO\s+v_updated_product_id/i
  )?.[0] ?? '';

const productUpdateSqlBlocks = [
  ...migrationSql.matchAll(
    /UPDATE\s+public\.products\s+SET[\s\S]*?RETURNING\s+products\.id\s+INTO\s+v_updated_product_id/gi
  ),
].map((match) => match[0]);

const productPersistUpdateSql = productUpdateSqlBlocks[0] ?? '';
const compatibilityUpdateSql = productUpdateSqlBlocks.at(-1) ?? '';
const productPersistenceSql = `${productInsertSql}\n${productPersistUpdateSql}`;

const variantSyncMatch = migrationSql.match(
  /IF\s+p_product_id\s+IS\s+NULL\s+OR\s+v_product_payload\s+\?\s+'has_variants'\s+THEN[\s\S]*?END\s+IF;/i
);
const variantSyncSql = variantSyncMatch?.[0] ?? '';

const variantSyncIndex = migrationSql.indexOf(
  'v_synced_variant_count := public.sync_product_variants_for_product'
);
const createVariantIdStripIndex = migrationSql.indexOf(
  "jsonb_agg(element.raw - 'id' ORDER BY element.ordinal)"
);
const anchorTargetPreparationIndex = migrationSql.indexOf(
  'INTO v_reassign_anchor_variant'
);
const anchorPointerClearIndex = migrationSql.indexOf(
  'inventory_anchor_variant_id = NULL'
);
const anchorTransferIndex = migrationSql.indexOf(
  'UPDATE public.variant_inventory'
);
const hiddenAnchorDeleteIndex = migrationSql.indexOf(
  'DELETE FROM public.product_variants\n    WHERE id = v_existing_anchor_id'
);

describe('mobile admin product RPC migration contract', () => {
  it('restores the public argument names used by the mobile app', () => {
    expect(migrationSql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.save_mobile_admin_product_with_variants\([\s\S]*p_variants\s+jsonb\s+DEFAULT\s+'\[\]'::jsonb[\s\S]*p_variant_model\s+text\s+DEFAULT\s+NULL/i
    );
    expect(migrationSql).not.toMatch(/p_variants_payload/i);
    expect(migrationSql).not.toMatch(/p_actor_role/i);
  });

  it('normalizes the mobile variant model into the product payload contract', () => {
    expect(migrationSql).toMatch(
      /jsonb_set\([\s\S]*COALESCE\(p_product_payload,\s+'\{\}'::jsonb\)[\s\S]*'\{variant_model\}'[\s\S]*to_jsonb\(v_variant_model\)/i
    );
  });

  it('keeps create and response semantics compatible with the mobile hook', () => {
    expect(migrationSql).toMatch(
      /v_product_id\s+uuid\s*:=\s*COALESCE\(p_product_id,\s*gen_random_uuid\(\)\)/i
    );
    expect(migrationSql).toMatch(
      /IF\s+p_product_id\s+IS\s+NULL\s+THEN[\s\S]*PERFORM\s+private\.enforce_mobile_admin_product_limit\(\s*p_merchant_id,\s*v_product_id\s*\)[\s\S]*ELSE/i
    );
    expect(migrationSql).toMatch(/SELECT\s+jsonb_build_object\(/i);
    expect(migrationSql).toMatch(/'id',\s*p\.id/i);
    expect(migrationSql).toMatch(/'name',\s*p\.name/i);
    expect(migrationSql).toMatch(/'stock_quantity',\s*p\.stock_quantity/i);
    expect(migrationSql).toMatch(/'variant_model',\s*p\.variant_model/i);
    expect(migrationSql).toMatch(/INTO\s+v_result/i);
  });

  it('normalizes create variant IDs before using the existing-row sync helper', () => {
    expect(createVariantIdStripIndex).toBeGreaterThan(-1);
    expect(createVariantIdStripIndex).toBeLessThan(variantSyncIndex);
    expect(migrationSql).toMatch(
      /v_variants_for_sync\s+jsonb\s*:=\s+'\[\]'::jsonb/i
    );
    expect(migrationSql).toMatch(
      /IF\s+p_product_id\s+IS\s+NULL\s+AND\s+v_has_variants\s+IS\s+TRUE\s+THEN[\s\S]*jsonb_agg\(element\.raw\s+-\s+'id'\s+ORDER\s+BY\s+element\.ordinal\)[\s\S]*FROM\s+jsonb_array_elements\(p_variants\)\s+WITH\s+ORDINALITY/i
    );
  });

  it('persists products using current columns instead of the broken private helper', () => {
    expect(migrationSql).not.toMatch(
      /private\.save_mobile_admin_product_with_variants/i
    );
    expect(productPersistenceSql).not.toMatch(/\bbarcode\b/i);
    expect(productPersistenceSql).not.toMatch(/\bweight\b/i);
    expect(productPersistenceSql).not.toMatch(/\btags\b/i);
    expect(productInsertSql).toMatch(/INSERT\s+INTO\s+public\.products/i);
    expect(productPersistenceSql).toMatch(/compare_at_price/i);
    expect(productPersistenceSql).toMatch(/inventory_tracking_policy/i);
    expect(migrationSql).not.toMatch(/\blow_stock_threshol\b/i);
  });

  it('preserves existing update-only invariants before saving product fields', () => {
    expect(migrationSql).toMatch(
      /SELECT\s+p\.has_variants,\s*p\.inventory_tracking_policy,\s*p\.inventory_anchor_variant_id[\s\S]*INTO\s+v_existing_has_variants,\s*v_existing_inventory_tracking_policy,\s*v_existing_anchor_id[\s\S]*FROM\s+public\.products\s+AS\s+p[\s\S]*WHERE\s+p\.id\s*=\s*p_product_id[\s\S]*AND\s+p\.merchant_id\s*=\s*p_merchant_id[\s\S]*FOR\s+UPDATE/i
    );
    expect(migrationSql).toMatch(
      /IF\s+NOT\s+FOUND\s+THEN[\s\S]*RAISE\s+EXCEPTION\s+'product_not_found'/i
    );
    expect(migrationSql).toMatch(
      /IF\s+NOT\s+\(v_product_payload\s+\?\s+'inventory_tracking_policy'\)\s+THEN[\s\S]*jsonb_set\([\s\S]*'\{inventory_tracking_policy\}'[\s\S]*to_jsonb\(v_existing_inventory_tracking_policy\)/i
    );
    expect(migrationSql).toMatch(
      /v_has_variants\s*:=\s*CASE[\s\S]*WHEN\s+v_product_payload\s+\?\s+'has_variants'\s+THEN\s+COALESCE\(NULLIF\(v_product_payload->>'has_variants',\s*''\)::boolean,\s*false\)[\s\S]*ELSE\s+COALESCE\(v_existing_has_variants,\s*false\)/i
    );
    expect(productPersistUpdateSql).toMatch(
      /has_variants\s*=\s*CASE[\s\S]*WHEN\s+v_product_payload\s+\?\s+'has_variants'\s+THEN\s+v_has_variants[\s\S]*ELSE\s+products\.has_variants/i
    );
  });

  it('keeps non-variant stock writable without overriding variant stock projections', () => {
    expect(productPersistUpdateSql).toMatch(
      /stock_quantity\s*=\s*CASE[\s\S]*WHEN\s+v_has_variants\s+IS\s+TRUE\s+THEN\s+products\.stock_quantity[\s\S]*WHEN\s+v_product_payload\s+\?\s+'stock_quantity'\s+THEN\s+NULLIF\(v_product_payload->>'stock_quantity',\s*''\)::integer/i
    );
    expect(productPersistUpdateSql).toMatch(
      /stock\s*=\s*CASE[\s\S]*WHEN\s+v_has_variants\s+IS\s+TRUE\s+THEN\s+products\.stock[\s\S]*WHEN\s+v_product_payload\s+\?\s+'stock'\s+THEN\s+NULLIF\(v_product_payload->>'stock',\s*''\)::integer/i
    );
    expect(compatibilityUpdateSql).not.toMatch(/\bstock_quantity\s*=/i);
    expect(compatibilityUpdateSql).not.toMatch(/\bstock\s*=/i);
    expect(migrationSql).toMatch(
      /PERFORM\s+private\.sync_serialized_stock\(\s*p_merchant_id,\s*v_product_id\s*\)/i
    );
  });

  it('preserves storefront slugs unless the payload explicitly includes one', () => {
    expect(productPersistUpdateSql).toMatch(
      /slug\s*=\s*CASE[\s\S]*WHEN\s+v_product_payload\s+\?\s+'slug'\s+THEN\s+NULLIF\(v_product_payload->>'slug',\s*''\)[\s\S]*ELSE\s+products\.slug/i
    );
  });

  it('uses the scoped variant sync so costs and ownership checks stay intact', () => {
    expect(variantSyncSql).toMatch(
      /public\.sync_product_variants_for_product\(\s*v_product_id,\s*p_merchant_id,\s*v_variants_for_sync\s*\)/i
    );
  });

  it('prepares conversion targets before variant sync and transfers hidden anchors after', () => {
    expect(anchorTargetPreparationIndex).toBeGreaterThan(-1);
    expect(anchorPointerClearIndex).toBeGreaterThan(-1);
    expect(variantSyncIndex).toBeGreaterThan(-1);
    expect(anchorTransferIndex).toBeGreaterThan(-1);
    expect(hiddenAnchorDeleteIndex).toBeGreaterThan(-1);
    expect(anchorTargetPreparationIndex).toBeLessThan(variantSyncIndex);
    expect(anchorPointerClearIndex).toBeLessThan(variantSyncIndex);
    expect(anchorTransferIndex).toBeGreaterThan(variantSyncIndex);
    expect(hiddenAnchorDeleteIndex).toBeGreaterThan(anchorTransferIndex);
    const anchorPreparationSql = migrationSql.slice(
      anchorTargetPreparationIndex,
      variantSyncIndex
    );
    expect(anchorPreparationSql).toContain(
      'FROM jsonb_array_elements(p_variants) AS element(raw)'
    );
    expect(anchorPreparationSql).toContain(
      "WHERE NULLIF(element.raw->>'id', '') = v_reassign_anchor_to_variant_id::text"
    );
    expect(anchorPreparationSql).toMatch(
      /INSERT\s+INTO\s+public\.product_variants/i
    );
    expect(anchorPreparationSql).toContain('v_reassign_anchor_to_variant_id');
    expect(anchorPreparationSql).toContain('v_reassign_anchor_variant');
    expect(anchorPreparationSql).toContain('is_inventory_anchor');
    expect(
      migrationSql.slice(variantSyncIndex, hiddenAnchorDeleteIndex)
    ).toMatch(
      /SELECT\s+pv\.id[\s\S]*INTO\s+v_reassign_anchor_to_variant_id[\s\S]*ORDER\s+BY\s+pv\.created_at\s+NULLS\s+LAST,\s*pv\.id[\s\S]*serialized_inventory_reassignment_required[\s\S]*PERFORM\s+1[\s\S]*FROM\s+public\.variant_inventory[\s\S]*FOR\s+UPDATE[\s\S]*serialized_inventory_reserved_units_exist[\s\S]*FOR\s+v_moved_inventory_unit_id\s+IN[\s\S]*UPDATE\s+public\.variant_inventory[\s\S]*RETURNING\s+id[\s\S]*private\.record_variant_inventory_event\(\s*v_moved_inventory_unit_id/i
    );
    expect(
      migrationSql.slice(anchorTransferIndex, hiddenAnchorDeleteIndex)
    ).not.toMatch(
      /private\.record_variant_inventory_event\(\s*NULL,\s*p_merchant_id,\s*v_product_id,\s*v_reassign_anchor_to_variant_id/i
    );
    expect(migrationSql).toMatch(
      /IF\s+v_has_variants\s+IS\s+NOT\s+TRUE[\s\S]*v_inventory_tracking_policy\s+IN\s+\('serialized_strict',\s+'serialized_then_unlimited'\)[\s\S]*PERFORM\s+private\.ensure_product_inventory_anchor_variant\(\s*p_merchant_id,\s*v_product_id\s*\)/i
    );
  });

  it('keeps the RPC restricted to authenticated API roles and refreshes PostgREST', () => {
    expect(migrationSql).toMatch(/SECURITY\s+DEFINER/i);
    expect(migrationSql).toMatch(/SET\s+search_path\s*=\s*''/i);
    expect(migrationSql).toMatch(
      /auth\.role\(\)\s+IS\s+DISTINCT\s+FROM\s+'service_role'[\s\S]*public\.has_merchant_access\(p_merchant_id\)\s+IS\s+NOT\s+TRUE/i
    );
    expect(migrationSql).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.save_mobile_admin_product_with_variants[\s\S]*FROM\s+PUBLIC,\s+anon,\s+authenticated,\s+service_role/i
    );
    expect(migrationSql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.save_mobile_admin_product_with_variants[\s\S]*TO\s+authenticated,\s+service_role/i
    );
    expect(migrationSql).toMatch(/NOTIFY\s+pgrst,\s+'reload schema'/i);
  });
});
