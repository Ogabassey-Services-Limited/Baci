import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260626130058_replace_imported_order_items_rpc.sql'
  ),
  'utf8'
);

function extractReplaceOrderItemsFunction() {
  return (
    migrationSql.match(
      /CREATE OR REPLACE FUNCTION public\.replace_order_items\([\s\S]*?\n\$\$;/i
    )?.[0] ?? ''
  );
}

function extractReplaceImportedOrderItemsFunction() {
  return (
    migrationSql.match(
      /CREATE OR REPLACE FUNCTION public\.replace_imported_order_items\([\s\S]*?\n\$\$;/i
    )?.[0] ?? ''
  );
}

function extractPopulateOrderItemTaxFunction() {
  return (
    migrationSql.match(
      /CREATE OR REPLACE FUNCTION public\.populate_order_item_tax\(\)[\s\S]*?\n\$\$;/i
    )?.[0] ?? ''
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('Bumpa imported order item RPC migration', () => {
  it('persists fulfillment detail patches in the generic item replacement RPC', () => {
    const replaceOrderItemsFunction = extractReplaceOrderItemsFunction();

    expect(replaceOrderItemsFunction).toMatch(
      /fulfillment_details = CASE WHEN v_order_patch \? 'fulfillment_details'[\s\S]*ELSE fulfillment_details END/i
    );
    expect(
      replaceOrderItemsFunction.indexOf('fulfillment_details =')
    ).toBeLessThan(replaceOrderItemsFunction.indexOf('shipping_address ='));
  });

  it('preserves explicit null fulfillment fields when merging imported order patches', () => {
    const replaceImportedOrderItemsFunction =
      extractReplaceImportedOrderItemsFunction();

    expect(replaceImportedOrderItemsFunction).toContain(
      "THEN v_order_patch->'fulfillment_details'"
    );
    expect(
      replaceImportedOrderItemsFunction.includes(
        "jsonb_strip_nulls(v_order_patch->'fulfillment_details')"
      )
    ).toBe(false);
  });

  it('replaces accepted imported shipping address patches instead of merging stale keys', () => {
    const replaceImportedOrderItemsFunction =
      extractReplaceImportedOrderItemsFunction();

    expect(replaceImportedOrderItemsFunction).toMatch(
      /shipping_address = CASE WHEN v_order_patch \? 'shipping_address'[\s\S]*THEN CASE[\s\S]*jsonb_strip_nulls\(v_order_patch->'shipping_address'\)[\s\S]*ELSE '\{\}'::jsonb[\s\S]*ELSE o\.shipping_address END/i
    );
    expect(
      replaceImportedOrderItemsFunction.includes('COALESCE(o.shipping_address')
    ).toBe(false);
  });

  it('preserves supplied imported line totals through the order item tax trigger', () => {
    const triggerFunction = extractPopulateOrderItemTaxFunction();

    expect(triggerFunction).toMatch(
      /o\.external_source IS NOT NULL OR o\.import_job_id IS NOT NULL/i
    );
    expect(triggerFunction).toMatch(
      /IF NEW\.line_extension_amount IS NOT NULL AND is_imported_order THEN[\s\S]*NEW\.line_extension_amount := ROUND\(NEW\.line_extension_amount, 2\)/i
    );
    expect(triggerFunction).toMatch(
      /ELSE[\s\S]*NEW\.line_extension_amount := ROUND\(NEW\.quantity \* NEW\.price, 2\)/i
    );
  });

  it('defaults missing standard VAT rates to zero before VAT amount math', () => {
    const triggerFunction = extractPopulateOrderItemTaxFunction();

    expect(triggerFunction).toMatch(
      /NEW\.vat_rate := COALESCE\(NEW\.vat_rate, 0\);[\s\S]*NEW\.vat_amount := ROUND\(NEW\.line_extension_amount \* NEW\.vat_rate \/ 100, 2\)/i
    );
  });

  it('uses a sequence-backed fallback for missing line IDs', () => {
    const triggerFunction = extractPopulateOrderItemTaxFunction();

    expect(migrationSql).toMatch(
      /CREATE SEQUENCE IF NOT EXISTS public\.order_items_fallback_line_id_seq/i
    );
    expect(triggerFunction).toMatch(
      /NEW\.line_id := nextval\('public\.order_items_fallback_line_id_seq'\)::INTEGER/i
    );
    expect(triggerFunction).not.toMatch(/MAX\(line_id\)/i);
  });

  it('restricts public imported-order replacement RPCs to the service role', () => {
    for (const signature of [
      'public.replace_order_items(UUID, JSONB, UUID, BOOLEAN, JSONB)',
      'public.replace_imported_order_items(uuid, jsonb, uuid, jsonb, timestamptz)',
    ]) {
      const escapedSignature = escapeRegExp(signature);

      expect(migrationSql).toMatch(
        new RegExp(
          `ALTER FUNCTION ${escapedSignature}\\s+OWNER TO postgres`,
          'i'
        )
      );
      expect(migrationSql).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION ${escapedSignature}\\s+FROM PUBLIC`,
          'i'
        )
      );
      expect(migrationSql).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION ${escapedSignature}\\s+FROM anon`,
          'i'
        )
      );
      expect(migrationSql).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION ${escapedSignature}\\s+FROM authenticated`,
          'i'
        )
      );
      expect(migrationSql).toMatch(
        new RegExp(
          `GRANT EXECUTE ON FUNCTION ${escapedSignature}\\s+TO service_role`,
          'i'
        )
      );
    }
  });
});
