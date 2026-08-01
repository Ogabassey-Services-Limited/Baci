import { describe, expect, it } from 'vitest';
import {
  buildProductDescriptionWriterInventoryCsv,
  parseProductDescriptionWriterInventoryCsv,
} from './product-description-writer-inventory-csv';
import { PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER } from './product-description-writer-inventory';

describe('product description writer inventory CSV', () => {
  it('round-trips quoted fields without changing the schema header', () => {
    const row = {
      inventory_version: '1',
      path: 'apps/web/src/writer.ts',
      caller_or_route: 'route, with "quotes"',
      operation: 'write',
      description_input_contract: 'line one\nline two',
      can_attest_source: 'no',
      unattested_source: 'unattested_pending_C2b',
      guard_error_contract: 'guard',
      test_path: 'apps/web/src/writer.test.ts',
      file_sha256: 'a'.repeat(64),
    } as const;
    const parsed = parseProductDescriptionWriterInventoryCsv(
      buildProductDescriptionWriterInventoryCsv([row])
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toEqual([row]);
    expect(buildProductDescriptionWriterInventoryCsv([row])).toContain(
      `${PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER}\n`
    );
  });
});
