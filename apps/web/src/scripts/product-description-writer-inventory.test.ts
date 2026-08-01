import { describe, expect, it } from 'vitest';
import {
  CURRENT_INVENTORY_ROWS,
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
  });
});
