import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  geminiFlash: 'gemini-test-model',
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

const { enrichProductsBatch } = await import('./generation-actions');

describe('enrichProductsBatch', () => {
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
    mocks.generateObject.mockResolvedValue({
      object: {
        results: [
          {
            attributes: { Brand: 'Apple' },
            category: 'Smartphones',
            description: 'Fast phone.',
            productName: 'iPhone 12',
            sku: 'APPL-IP12',
          },
        ],
      },
    });
  });

  it('returns empty results without auth before resolving permissions or invoking AI', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const result = await enrichProductsBatch(['iPhone 12']);

    expect(result).toEqual([]);
    expect(mocks.ensurePermission).not.toHaveBeenCalled();
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it('returns empty results when product permission is denied', async () => {
    mocks.ensurePermission.mockRejectedValueOnce(
      new Error('Insufficient permissions')
    );

    const result = await enrichProductsBatch(['iPhone 12']);

    expect(result).toEqual([]);
    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'create');
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it('requires product create permission before invoking AI enrichment', async () => {
    const result = await enrichProductsBatch(['iPhone 12']);

    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'create');
    expect(mocks.generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-test-model',
      })
    );
    expect(result).toEqual([
      {
        attributes: { Brand: 'Apple' },
        category: 'Smartphones',
        description: 'Fast phone.',
        productName: 'iPhone 12',
        sku: 'APPL-IP12',
      },
    ]);
  });
});
