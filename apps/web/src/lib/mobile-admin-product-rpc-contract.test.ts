import { describe, expect, it } from 'vitest';

import { mobileAdminProductRpcContract } from './mobile-admin-product-rpc-contract.sql-fixture';

const {
  anchorPointerClearIndex,
  anchorTargetPreparationIndex,
  anchorTransferIndex,
  createVariantIdStripIndex,
  createVariantModelEndIndex,
  createVariantModelIndex,
  createVariantModelSql,
  hiddenAnchorDeleteIndex,
  latestRpcMigration,
  migrationFileName,
  migrationSql,
  productInsertSql,
  productPersistUpdateIndex,
  productPersistUpdateSql,
  productPersistenceSql,
  postSerializedStockSyncSql,
  publicRpcDefinitionPattern,
  rpcMigrationEntries,
  serializedStockSyncIndex,
  updateVariantModelEndIndex,
  updateVariantModelIndex,
  updateVariantModelSql,
  variantSyncIndex,
  variantSyncSql,
} = mobileAdminProductRpcContract;

describe('mobile admin product RPC migration contract', () => {
  it('asserts against the latest migration that changes the public RPC', () => {
    expect(latestRpcMigration?.fileName).toBe(migrationFileName);
    expect(latestRpcMigration?.sql).toMatch(publicRpcDefinitionPattern);
    expect(
      rpcMigrationEntries.filter(({ fileName }) => fileName > migrationFileName)
    ).toEqual([]);
  });

  it('restores the public argument names used by the mobile app', () => {
    expect(migrationSql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.save_mobile_admin_product_with_variants\([\s\S]*p_variants\s+jsonb\s+DEFAULT\s+'\[\]'::jsonb[\s\S]*p_variant_model\s+text\s+DEFAULT\s+NULL/i
    );
    expect(migrationSql).not.toMatch(/p_variants_payload/i);
    expect(migrationSql).not.toMatch(/p_actor_role/i);
  });

  it('replaces only the canonical RPC signature used in migration history', () => {
    expect(migrationSql).not.toMatch(
      /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.save_mobile_admin_product_with_variants\(\s*uuid,\s*uuid,\s*jsonb\s*\)/i
    );
    expect(migrationSql).not.toMatch(
      /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.save_mobile_admin_product_with_variants\(\s*uuid,\s*uuid,\s*jsonb,\s*jsonb\s*\)/i
    );
    expect(migrationSql).toMatch(
      /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.save_mobile_admin_product_with_variants\(\s*uuid,\s*uuid,\s*jsonb,\s*jsonb,\s*text\s*\)/i
    );
  });

  it('normalizes the mobile variant model into the product payload contract', () => {
    expect(createVariantModelIndex).toBeGreaterThan(-1);
    expect(createVariantModelEndIndex).toBeGreaterThan(createVariantModelIndex);
    expect(migrationSql).toMatch(
      /v_product_payload\s+jsonb\s*:=\s*COALESCE\(p_product_payload,\s+'\{\}'::jsonb\)/i
    );
    expect(createVariantModelSql).toContain("NULLIF(p_variant_model, '')");
    expect(createVariantModelSql).toContain(
      "NULLIF(v_product_payload->>'variant_model', '')"
    );
    expect(createVariantModelSql).toContain("'legacy'");
    expect(createVariantModelSql).toContain('v_product_payload := jsonb_set(');
    expect(createVariantModelSql).toContain("'{variant_model}'");
    expect(createVariantModelSql).toContain('to_jsonb(v_variant_model)');
  });

  it('preserves the existing variant model for partial update saves', () => {
    expect(updateVariantModelIndex).toBeGreaterThan(-1);
    expect(updateVariantModelEndIndex).toBeGreaterThan(updateVariantModelIndex);
    expect(migrationSql).toMatch(/v_existing_variant_model\s+text/i);
    expect(migrationSql).toMatch(
      /SELECT\s+p\.has_variants,\s*p\.inventory_tracking_policy,\s*p\.inventory_anchor_variant_id,\s*p\.variant_model\s+INTO\s+v_existing_has_variants,\s*v_existing_inventory_tracking_policy,\s*v_existing_anchor_id,\s*v_existing_variant_model/i
    );
    expect(updateVariantModelSql).toContain("NULLIF(p_variant_model, '')");
    expect(updateVariantModelSql).toContain(
      "NULLIF(v_product_payload->>'variant_model', '')"
    );
    expect(updateVariantModelSql).toContain('v_existing_variant_model');
    expect(updateVariantModelSql).toContain("'legacy'");
    expect(updateVariantModelSql).toContain('v_product_payload := jsonb_set(');
    expect(updateVariantModelSql).toContain("'{variant_model}'");
    expect(updateVariantModelSql).toContain('to_jsonb(v_variant_model)');
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
    expect(postSerializedStockSyncSql).not.toMatch(
      /UPDATE\s+public\.products[\s\S]*\bstock(?:_quantity)?\s*=/i
    );
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

  it('syncs supplied variants on existing variant-product updates', () => {
    expect(variantSyncSql).toContain('IF p_product_id IS NULL');
    expect(variantSyncSql).toContain("OR v_product_payload ? 'has_variants'");
    expect(variantSyncSql).toContain(
      'OR (v_has_variants IS TRUE AND jsonb_array_length(v_variants_for_sync) > 0)'
    );
  });

  it('keeps migration status aligned with the stored variant model', () => {
    expect(productPersistUpdateSql).toMatch(/migration_status\s*=\s*CASE/i);
    expect(productPersistUpdateSql).toMatch(
      /WHEN\s+v_variant_model\s*=\s*'sku_matrix'\s+THEN\s+'migrated'/i
    );
    expect(productPersistUpdateSql).toMatch(
      /WHEN\s+v_variant_model\s*=\s*'legacy'\s+AND\s+products\.migration_status\s*=\s*'migrated'\s+THEN\s+'pending'/i
    );
  });

  it('does not overwrite SKU condition after projection sync', () => {
    expect(serializedStockSyncIndex).toBeGreaterThan(productPersistUpdateIndex);
    expect(postSerializedStockSyncSql).not.toMatch(
      /UPDATE\s+public\.products[\s\S]*\bcondition\s*=/i
    );
    expect(postSerializedStockSyncSql).toMatch(
      /SELECT\s+p\.id\s+INTO\s+v_updated_product_id[\s\S]*FROM\s+public\.products\s+AS\s+p/i
    );
  });

  it('prepares conversion targets and deletes hidden anchors before product sync', () => {
    expect(anchorTargetPreparationIndex).toBeGreaterThan(-1);
    expect(anchorPointerClearIndex).toBeGreaterThan(-1);
    expect(variantSyncIndex).toBeGreaterThan(-1);
    expect(anchorTransferIndex).toBeGreaterThan(-1);
    expect(hiddenAnchorDeleteIndex).toBeGreaterThan(-1);
    expect(productPersistUpdateIndex).toBeGreaterThan(-1);
    expect(anchorTargetPreparationIndex).toBeLessThan(variantSyncIndex);
    expect(anchorTransferIndex).toBeLessThan(anchorPointerClearIndex);
    expect(anchorPointerClearIndex).toBeLessThan(hiddenAnchorDeleteIndex);
    expect(hiddenAnchorDeleteIndex).toBeLessThan(productPersistUpdateIndex);
    expect(hiddenAnchorDeleteIndex).toBeLessThan(variantSyncIndex);
    const anchorConversionSql = migrationSql.slice(
      anchorTargetPreparationIndex,
      hiddenAnchorDeleteIndex
    );
    expect(anchorConversionSql).toContain(
      'FROM jsonb_array_elements(v_variants_for_sync) WITH ORDINALITY AS element(raw, ordinal)'
    );
    expect(anchorConversionSql).toContain('public.condition_rank(');
    expect(anchorConversionSql).toContain('v_reassign_anchor_variant_ordinal');
    expect(anchorConversionSql).toContain('gen_random_uuid()');
    expect(anchorConversionSql).toMatch(
      /jsonb_set\(\s*element\.raw\s*,\s*'\{id\}'\s*,\s*to_jsonb\(v_reassign_anchor_to_variant_id::text\)\s*,\s*true\s*\)/i
    );
    expect(anchorConversionSql).toContain(
      "WHERE NULLIF(element.raw->>'id', '') = v_reassign_anchor_to_variant_id::text"
    );
    expect(anchorConversionSql).toMatch(
      /INSERT\s+INTO\s+public\.product_variants/i
    );
    expect(anchorConversionSql).toContain('v_reassign_anchor_to_variant_id');
    expect(anchorConversionSql).toContain('v_reassign_anchor_variant');
    expect(anchorConversionSql).toContain('is_inventory_anchor');
    expect(anchorConversionSql).toContain('SELECT p.default_variant_id');
    expect(anchorConversionSql).toContain('pv.id = p.default_variant_id');
    expect(anchorConversionSql).toContain('pv.is_inventory_anchor = false');
    expect(anchorConversionSql).toContain(
      'count(*) OVER () AS candidate_count'
    );
    expect(anchorConversionSql).toContain(
      'WHERE candidate.candidate_count = 1'
    );
    expect(anchorConversionSql).toContain('SELECT candidate.id');
    expect(anchorConversionSql).toContain(
      'INTO v_reassign_anchor_to_variant_id'
    );
    expect(anchorConversionSql).toContain(
      'ORDER BY candidate.created_at NULLS LAST, candidate.id'
    );
    expect(anchorConversionSql).toContain(
      "RAISE EXCEPTION 'serialized_inventory_reassignment_required'"
    );
    expect(anchorConversionSql).toContain('PERFORM 1');
    expect(anchorConversionSql).toContain('FROM public.variant_inventory');
    expect(anchorConversionSql).toContain('FOR UPDATE');
    expect(anchorConversionSql).toContain("AND status = 'reserved'");
    expect(anchorConversionSql).toContain(
      "RAISE EXCEPTION 'serialized_inventory_reserved_units_exist'"
    );
    expect(anchorConversionSql).toContain('FOR v_moved_inventory_unit_id IN');
    expect(anchorConversionSql).toContain('UPDATE public.variant_inventory');
    expect(anchorConversionSql).toContain('RETURNING id');
    expect(anchorConversionSql).toContain(
      'private.record_variant_inventory_event('
    );
    expect(anchorConversionSql).toContain('v_moved_inventory_unit_id');
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
