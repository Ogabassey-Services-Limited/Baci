import { describe, expect, it } from 'vitest';
import { countProductsMissingUsableDescriptionsInPages } from './count-products-missing-usable-descriptions-in-pages';

const PAGE_SIZE = 250;

describe('countProductsMissingUsableDescriptionsInPages', () => {
  it('counts null, empty, and whitespace-only descriptions as missing', async () => {
    const count = await countProductsMissingUsableDescriptionsInPages(
      async () => ({
        data: [
          { description: null },
          { description: '' },
          { description: '   \n\t' },
          { description: 'Useful product copy' },
        ],
        error: null,
      })
    );

    expect(count).toBe(3);
  });

  it('continues after a full page and fails closed on query errors', async () => {
    const ranges: Array<{ from: number; to: number }> = [];
    const count = await countProductsMissingUsableDescriptionsInPages(
      async ({ from, to }) => {
        ranges.push({ from, to });
        return from === 0
          ? {
              data: Array.from({ length: PAGE_SIZE }, () => ({
                description: ' ',
              })),
              error: null,
            }
          : { data: [{ description: 'Ready' }], error: null };
      }
    );

    expect(count).toBe(PAGE_SIZE);
    expect(ranges).toEqual([
      { from: 0, to: PAGE_SIZE - 1 },
      { from: PAGE_SIZE, to: PAGE_SIZE * 2 - 1 },
    ]);
    await expect(
      countProductsMissingUsableDescriptionsInPages(async () => ({
        data: null,
        error: { message: 'catalog unavailable' },
      }))
    ).rejects.toThrow('catalog unavailable');
  });
});
