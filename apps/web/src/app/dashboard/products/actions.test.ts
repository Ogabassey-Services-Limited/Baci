import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';

const mocks = vi.hoisted(() => ({
  ensurePermission: vi.fn(),
  generateObject: vi.fn(),
  getUser: vi.fn(),
  withRetry: vi.fn(),
}));

vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mocks.generateObject(...args),
}));

vi.mock('@/ai/provider', () => ({
  gemini25FlashImage: 'gemini-image-test-model',
  geminiFlash: 'gemini-test-model',
  sanitizePromptInput: (value: string) => ({ value }),
  withRetry: (operation: () => Promise<unknown>) => mocks.withRetry(operation),
}));

vi.mock('@/lib/merchant-server', () => ({
  ensurePermission: (...args: unknown[]) => mocks.ensurePermission(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
  })),
}));

const { fetchGoogleSheet, parseCSVDirectly, processPriceList } = await import(
  './actions'
);

const existingProducts = [
  {
    id: 'product-1',
    name: 'Old Phone',
    price: 1000,
    sku: 'OLD-1',
    stock: 5,
  },
] as unknown as Product[];

describe('product import actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mocks.ensurePermission.mockResolvedValue({
      merchant: { id: 'merchant-1' },
      staffAccess: { isOwner: true },
    });
    mocks.withRetry.mockImplementation((operation: () => Promise<unknown>) =>
      operation()
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not process price lists with AI for unauthenticated callers', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const result = await processPriceList(
      existingProducts,
      'Name,Price\nNew Phone,2000',
      'Vendor',
      'text/csv'
    );

    expect(result).toEqual({ changes: [], summary: 'Unauthorized' });
    expect(mocks.ensurePermission).not.toHaveBeenCalled();
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it('does not process price lists with AI when product create permission is denied', async () => {
    mocks.ensurePermission.mockRejectedValueOnce(new Error('Forbidden'));

    const result = await processPriceList(
      existingProducts,
      'Name,Price\nNew Phone,2000',
      'Vendor',
      'text/csv'
    );

    expect(result).toEqual({ changes: [], summary: 'Unauthorized' });
    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'create');
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it('processes price lists with AI after product create authorization', async () => {
    mocks.generateObject.mockResolvedValueOnce({
      object: {
        changes: [
          {
            details: {
              name: 'New Phone',
              price: 2000,
            },
            type: 'new',
          },
        ],
        summary: 'Found 1 new product',
      },
    });

    const result = await processPriceList(
      existingProducts,
      'Name,Price\nNew Phone,2000',
      'Vendor',
      'text/csv'
    );

    expect(result).toEqual({
      changes: [
        {
          details: {
            name: 'New Phone',
            price: 2000,
          },
          type: 'new',
        },
      ],
      summary: 'Found 1 new product',
    });
    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'create');
    expect(mocks.generateObject).toHaveBeenCalledOnce();
  });

  it('does not parse CSV for unauthenticated callers', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Price\nNew Phone,2000'
    );

    expect(result).toEqual({ changes: [], summary: 'Unauthorized' });
    expect(mocks.ensurePermission).not.toHaveBeenCalled();
  });

  it('does not parse CSV when product create permission is denied', async () => {
    mocks.ensurePermission.mockRejectedValueOnce(new Error('Denied'));

    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Price\nNew Phone,2000'
    );

    expect(result).toEqual({ changes: [], summary: 'Unauthorized' });
    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'create');
  });

  it('parses CSV after product create authorization', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Price,SKU\nNew Phone,2000,NEW-1'
    );

    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'create');
    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes).toEqual([
      {
        details: {
          category: 'General',
          image: undefined,
          name: 'New Phone',
          price: 2000,
          sku: 'NEW-1',
          stock: 0,
        },
        type: 'new',
      },
      {
        details: {
          name: 'Old Phone',
          price: 1000,
          sku: 'OLD-1',
        },
        productId: 'product-1',
        reason: 'Not found in updated price list',
        type: 'remove',
      },
    ]);
  });

  it('does not fetch Google Sheets for unauthenticated callers', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(
      fetchGoogleSheet('https://docs.google.com/spreadsheets/d/sheet-id/edit')
    ).rejects.toThrow('Unauthorized');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not fetch Google Sheets when product create permission is denied', async () => {
    mocks.ensurePermission.mockRejectedValueOnce(new Error('Forbidden'));
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(
      fetchGoogleSheet('https://docs.google.com/spreadsheets/d/sheet-id/edit')
    ).rejects.toThrow('Unauthorized');

    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'create');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches Google Sheets after product create authorization', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      statusText: 'OK',
      text: async () => 'Name,Price\nNew Phone,2000',
    });
    vi.stubGlobal('fetch', fetchSpy);

    await expect(
      fetchGoogleSheet('https://docs.google.com/spreadsheets/d/sheet-id/edit')
    ).resolves.toBe('Name,Price\nNew Phone,2000');

    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'create');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://docs.google.com/spreadsheets/d/sheet-id/export?format=csv',
      {
        headers: { Accept: 'text/csv' },
        method: 'GET',
      }
    );
  });
});
