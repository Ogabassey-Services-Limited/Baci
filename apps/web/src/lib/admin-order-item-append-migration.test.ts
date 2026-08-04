import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260803120000_allow_safe_admin_order_item_append.sql'
  ),
  'utf8'
);

const appendFunctionSql =
  migrationSql
    .split('CREATE OR REPLACE FUNCTION public.append_admin_order_items(')[1]
    ?.split('ALTER FUNCTION public.append_admin_order_items')[0] ?? '';

describe('safe admin order item append migration', () => {
  it('preserves protected rows while accepting one strict new-line append', () => {
    expect(appendFunctionSql.length).toBeGreaterThan(0);
    expect(appendFunctionSql).toContain('EXCEPT ALL');
    expect(appendFunctionSql).toContain(
      "RAISE EXCEPTION 'order_item_append_requires_existing_lines_unchanged'"
    );
    expect(appendFunctionSql).toContain(
      "RAISE EXCEPTION 'order_item_append_supports_one_new_line'"
    );
    expect(appendFunctionSql).toContain(
      'FROM jsonb_array_elements(v_existing_items) AS existing_item(item)'
    );
    expect(appendFunctionSql).toContain(
      'FROM jsonb_array_elements(v_new_items) AS new_item(item)'
    );
    expect(appendFunctionSql).toContain(
      "ROUND(\n      (v_added_item ->> 'price')::numeric * (v_added_item ->> 'quantity')::integer,\n      2\n    )"
    );
    expect(appendFunctionSql).toContain('FOR UPDATE OF p');
    expect(appendFunctionSql).toContain('COALESCE(p.manage_stock, true)');
    expect(appendFunctionSql).toContain(
      "ON p.id = NULLIF(item ->> 'product_id', '')::uuid"
    );
    expect(appendFunctionSql).toContain(
      "v_tax_amount := (p_payload ->> 'tax_amount')::numeric;"
    );
    expect(appendFunctionSql).toContain(
      'WHEN allocated.allocation_row_count = 1 THEN v_tax_amount'
    );
    expect(appendFunctionSql).toContain(
      'SUM(gt.tax_weight) OVER () AS total_tax_weight'
    );
    expect(appendFunctionSql).toContain(
      'WHEN allocated.tax_weight <= 0 THEN 0'
    );
    expect(appendFunctionSql).toContain(
      "'exemption_reason', ots.exemption_reason"
    );
    expect(appendFunctionSql).toContain(
      "'exemption_reason_code', ots.exemption_reason_code"
    );
    expect(appendFunctionSql).toContain('exemption_reason_code\n    )');
    expect(appendFunctionSql).not.toContain(
      'COALESCE(SUM(oi.vat_amount), 0)\n    INTO v_subtotal, v_tax_amount'
    );
    expect(appendFunctionSql).toContain(
      'SELECT m.vat_registration_status\n' +
        '    INTO v_vat_registration_status\n' +
        '  FROM public.merchants AS m\n' +
        '  WHERE m.id = v_order.merchant_id\n' +
        '  FOR UPDATE;'
    );
    const vatLockIndex = appendFunctionSql.indexOf(
      'SELECT m.vat_registration_status\n' +
        '    INTO v_vat_registration_status\n' +
        '  FROM public.merchants AS m\n' +
        '  WHERE m.id = v_order.merchant_id\n' +
        '  FOR UPDATE;'
    );
    const itemInsertIndex = appendFunctionSql.indexOf(
      'INSERT INTO public.order_items ('
    );
    expect(vatLockIndex).toBeGreaterThanOrEqual(0);
    expect(vatLockIndex).toBeLessThan(itemInsertIndex);
    expect(appendFunctionSql).toContain(
      "'variant_name', NULLIF(btrim(oi.variant_name), '')"
    );
    expect(appendFunctionSql).toContain('INSERT INTO public.order_items (');
    expect(appendFunctionSql).not.toContain('DELETE FROM public.order_items');
  });

  it('keeps the existing RPC contract and only falls back for accounting metadata', () => {
    expect(migrationSql).toContain(
      "IF to_regprocedure('public.update_admin_order_replace(uuid,jsonb)') IS NULL"
    );
    expect(migrationSql).toContain(
      "IF to_regprocedure('public.update_admin_order(uuid,jsonb)') IS NULL"
    );
    expect(migrationSql).toContain(
      'ALTER FUNCTION public.update_admin_order(uuid, jsonb)\n      RENAME TO update_admin_order_replace;'
    );
    expect(migrationSql).toContain(
      "IF SQLERRM NOT LIKE '%order_item_replacement_has_accounting_metadata%'"
    );
    expect(migrationSql).toContain(
      "RAISE EXCEPTION 'order_item_append_supports_one_new_line'"
    );
    expect(migrationSql).toContain(
      'RETURN public.append_admin_order_items(p_order_id, p_payload);'
    );
    expect(migrationSql).toContain(
      'GRANT EXECUTE ON FUNCTION public.update_admin_order(uuid, jsonb)\n  TO authenticated;'
    );
  });
});
