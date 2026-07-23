import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ensurePermission: vi.fn(),
  generateObject: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mocks.generateObject(...args),
}));

// generateObjectWithChain builds its default chain via @/ai/text-provider-chain,
// which reads these exports from @/ai/provider — extend the partial mock with
// them (real chain/executor modules run unmocked, only their model source is
// stubbed) rather than stubbing the whole chain layer.
vi.mock('@/ai/provider', () => ({
  ACTIVE_TEXT_MODEL_NAME: 'gemini-2.5-flash',
  FALLBACK_TEXT_MODEL_NAME: 'gemini-2.5-flash-lite',
  activeTextModel: 'gemini-active-test-model',
  fallbackTextModel: 'gemini-fallback-test-model',
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
    // Force the keyless (Gemini-only, 2-provider) chain so provider-count
    // assertions below are deterministic regardless of ambient env.
    vi.stubEnv('CEREBRAS_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', '');
    vi.stubEnv('OPENROUTER_API_KEY', '');
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mocks.ensurePermission.mockResolvedValue({
      merchant: { id: 'merchant-1' },
      staffAccess: { isOwner: true },
    });
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

  afterEach(() => {
    vi.unstubAllEnvs();
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
        model: 'gemini-active-test-model',
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

  it('falls through to the fallback model when the primary provider fails', async () => {
    mocks.generateObject.mockReset();
    mocks.generateObject
      .mockRejectedValueOnce(new Error('primary quota exceeded'))
      .mockResolvedValueOnce({
        object: {
          results: [
            {
              attributes: {},
              category: 'Audio',
              description: 'Great sound.',
              productName: 'Speaker',
              sku: 'SPK-1',
            },
          ],
        },
      });

    const result = await enrichProductsBatch(['Speaker']);

    expect(mocks.generateObject).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      {
        attributes: {},
        category: 'Audio',
        description: 'Great sound.',
        productName: 'Speaker',
        sku: 'SPK-1',
      },
    ]);
  });

  it('returns an empty array when every AI provider in the chain fails', async () => {
    mocks.generateObject.mockReset();
    mocks.generateObject.mockRejectedValue(new Error('quota exceeded'));

    const result = await enrichProductsBatch(['iPhone 12']);

    expect(result).toEqual([]);
    // Keyless env => 2-provider Gemini-only text chain; both attempted.
    expect(mocks.generateObject).toHaveBeenCalledTimes(2);
  });
});
