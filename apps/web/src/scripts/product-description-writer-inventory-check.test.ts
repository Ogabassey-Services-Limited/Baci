import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkProductDescriptionWriterInventory } from './product-description-writer-inventory-check';
import * as writerDiscovery from './product-description-writer-discovery';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('product description writer inventory check', () => {
  it('rejects an inventory with an invalid header before filesystem discovery', async () => {
    const discoverWriterPaths = vi.spyOn(writerDiscovery, 'discoverWriterPaths');

    await expect(
      checkProductDescriptionWriterInventory({
        inventoryCsv: 'not,a,writer,inventory\n',
        repositoryRoot: '/tmp',
      })
    ).resolves.toEqual({
      errors: ['Inventory CSV header does not match the required schema'],
      ok: false,
    });
    expect(discoverWriterPaths).not.toHaveBeenCalled();
  });
});
