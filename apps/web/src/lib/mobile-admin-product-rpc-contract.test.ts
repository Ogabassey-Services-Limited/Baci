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

const compatibilityUpdateMatch = migrationSql.match(
  /UPDATE\s+public\.products[\s\S]*?RETURNING\s+products\.id\s+INTO\s+v_updated_product_id/i
);

const compatibilityUpdateSql = compatibilityUpdateMatch?.[0] ?? '';

describe('mobile admin product RPC migration contract', () => {
  it('restores the public argument names used by the mobile app', () => {
    expect(migrationSql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.save_mobile_admin_product_with_variants\([\s\S]*p_variants\s+jsonb\s+DEFAULT\s+'\[\]'::jsonb[\s\S]*p_variant_model\s+text\s+DEFAULT\s+NULL/i
    );
    expect(migrationSql).not.toMatch(/p_variants_payload/i);
    expect(migrationSql).not.toMatch(/p_actor_role/i);
  });

  it('forwards the mobile variant model into the private payload contract', () => {
    expect(migrationSql).toMatch(
      /jsonb_set\([\s\S]*COALESCE\(p_product_payload,\s+'\{\}'::jsonb\)[\s\S]*'\{variant_model\}'[\s\S]*to_jsonb\(v_variant_model\)/i
    );
    expect(migrationSql).toMatch(
      /PERFORM\s+private\.save_mobile_admin_product_with_variants\([\s\S]*v_product_id[\s\S]*v_product_payload[\s\S]*p_variants[\s\S]*NULL/i
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
    expect(migrationSql).toMatch(
      /UPDATE\s+public\.products[\s\S]*fulfillment_details\s*=[\s\S]*variant_attributes\s*=/i
    );
    expect(compatibilityUpdateMatch).not.toBeNull();
    expect(compatibilityUpdateSql).not.toMatch(/\bstock_quantity\s*=/i);
    expect(compatibilityUpdateSql).not.toMatch(/\bstock\s*=/i);
  });

  it('preserves existing update-only invariants before delegating to the private helper', () => {
    expect(migrationSql).toMatch(
      /SELECT\s+p\.inventory_tracking_policy[\s\S]*INTO\s+v_existing_inventory_tracking_policy[\s\S]*FROM\s+public\.products\s+AS\s+p[\s\S]*WHERE\s+p\.id\s*=\s*p_product_id[\s\S]*AND\s+p\.merchant_id\s*=\s*p_merchant_id[\s\S]*FOR\s+UPDATE/i
    );
    expect(migrationSql).toMatch(
      /IF\s+NOT\s+FOUND\s+THEN[\s\S]*RAISE\s+EXCEPTION\s+'product_not_found'/i
    );
    expect(migrationSql).toMatch(
      /IF\s+NOT\s+\(v_product_payload\s+\?\s+'inventory_tracking_policy'\)\s+THEN[\s\S]*jsonb_set\([\s\S]*'\{inventory_tracking_policy\}'[\s\S]*to_jsonb\(v_existing_inventory_tracking_policy\)/i
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
