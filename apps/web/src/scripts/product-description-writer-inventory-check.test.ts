import { describe, expect, it } from 'vitest';
import { checkProductDescriptionWriterInventory } from './product-description-writer-inventory-check';

describe('product description writer inventory check', () => {
  it('rejects an inventory with an invalid header before filesystem discovery', async () => {
    await expect(
      checkProductDescriptionWriterInventory({
        inventoryCsv: 'not,a,writer,inventory\n',
        repositoryRoot: '/tmp',
      })
    ).resolves.toEqual({
      errors: ['Inventory CSV header does not match the required schema'],
      ok: false,
    });
  });
});
