import { describe, expect, it } from 'vitest';
import {
  CURRENT_INVENTORY_ROWS,
  CURRENT_INVENTORY_ROWS_BY_PATH,
  INVENTORY_COLUMNS,
  PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER,
} from './product-description-writer-inventory';

describe('product description writer inventory definition', () => {
  it('keeps canonical rows aligned with the declared columns', () => {
    expect(INVENTORY_COLUMNS).toEqual(
      PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER.split(',')
    );
    expect(CURRENT_INVENTORY_ROWS.length).toBeGreaterThan(0);
    expect(CURRENT_INVENTORY_ROWS.every((row) =>
      INVENTORY_COLUMNS.every((column) => typeof row[column] === 'string')
    )).toBe(true);
    expect(
      CURRENT_INVENTORY_ROWS.every((row) => /^[0-9a-f]{64}$/.test(row.file_sha256))
    ).toBe(true);
  });

  it('inventories the delegated create-product writer with its current route hash', () => {
    expect(
      CURRENT_INVENTORY_ROWS_BY_PATH.get(
        'apps/web/src/app/api/products/create-product.ts'
      )
    ).toMatchObject({
      operation: 'insert public.products.description',
      test_path: 'apps/web/src/app/api/products/create-product.test.ts',
      file_sha256:
        'a3f477c37f68e72ed054c1eeef785c5f9cf8c15db620b826e602339d36e8174f',
    });
    expect(
      CURRENT_INVENTORY_ROWS_BY_PATH.get(
        'apps/web/src/app/api/products/route.ts'
      )?.file_sha256
    ).toBe(
      '333c0f88c0e935d9b9b7596db207732d0e59a1ff953dea92ef6a2e84ab060584'
    );
  });
});
