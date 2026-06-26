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
