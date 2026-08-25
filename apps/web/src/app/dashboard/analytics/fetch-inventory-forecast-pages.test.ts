import { describe, expect, it } from 'vitest';
import { fetchInventoryForecastPages } from './fetch-inventory-forecast-pages';

describe('fetchInventoryForecastPages', () => {
  it('bounds concurrent page requests while preserving page order', async () => {
    let activeRequests = 0;
    let maxActiveRequests = 0;

    const pages = await fetchInventoryForecastPages(async (page) => {
      if (page === 1) {
        return { pagination: { totalPages: 10 } };
      }

      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      await Promise.resolve();
      activeRequests -= 1;
      return { page };
    });

    expect(maxActiveRequests).toBe(4);
    expect(pages.map((payload) => payload.page)).toEqual([
      undefined,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
    ]);
  });

  it('rejects an invalid page count before issuing unbounded requests', async () => {
    const fetchPage = async () => ({ pagination: { totalPages: 1001 } });

    await expect(fetchInventoryForecastPages(fetchPage)).rejects.toThrow(
      'Inventory forecast pagination is invalid'
    );
  });
});
