import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provisionCuratedHomepage } from './provision-curated-homepage';

const providerTraps = vi.hoisted(() => ({
  cerebras: vi.fn(() => {
    throw new Error('Cerebras factory must not run');
  }),
  google: vi.fn(() => {
    throw new Error('Google factory must not run');
  }),
  groq: vi.fn(() => {
    throw new Error('Groq factory must not run');
  }),
  openAICompatible: vi.fn(() => {
    throw new Error('OpenAI-compatible factory must not run');
  }),
  fetch: vi.fn(() => {
    throw new Error('fetch must not run');
  }),
}));

vi.mock('@ai-sdk/cerebras', () => ({ createCerebras: providerTraps.cerebras }));
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: providerTraps.google,
}));
vi.mock('@ai-sdk/groq', () => ({ createGroq: providerTraps.groq }));
vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: providerTraps.openAICompatible,
}));

function createClient() {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { updated_at: '2026-08-03T00:00:00.000Z' },
    error: null,
  });
  const select = vi.fn(() => ({ maybeSingle }));
  const insert = vi.fn<
    (row: Record<string, unknown>) => { select: typeof select }
  >(() => ({ select }));

  return {
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
      },
      from: vi.fn(() => ({ insert })),
    },
    insert,
  };
}

function getHeroHeadingLevel(config: unknown): unknown {
  if (!config || typeof config !== 'object' || !('content' in config))
    return undefined;
  const { content } = config;
  if (!Array.isArray(content)) return undefined;
  const hero = content.find(
    (block) =>
      block &&
      typeof block === 'object' &&
      'type' in block &&
      block.type === 'Hero' &&
      'props' in block
  );
  if (!hero || typeof hero !== 'object' || !('props' in hero)) return undefined;
  const { props } = hero;
  return props && typeof props === 'object' && 'headingLevel' in props
    ? props.headingLevel
    : undefined;
}

describe('provisionCuratedHomepage provider independence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', providerTraps.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('inserts a real deterministic Hero h1 without provider factories or fetch', async () => {
    const { client, insert } = createClient();

    await expect(
      provisionCuratedHomepage({
        supabase: client,
        expectedOwnerUserId: 'u1',
        merchantId: 'merchant-1',
        merchantSlug: 'carepoint',
        merchantLogoUrl: '/media/logo.png',
        businessName: 'CarePoint',
        businessType: 'pharmaceuticals',
        brandColors: {
          primary: '#0f766e',
          background: '#ffffff',
          accent: '#22c55e',
        },
      })
    ).resolves.toEqual({
      status: 'created',
      updatedAt: '2026-08-03T00:00:00.000Z',
    });

    const payload = insert.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(getHeroHeadingLevel(payload?.draft_config)).toBe('h1');
    expect(payload?.draft_config).toEqual(payload?.published_config);
    for (const trap of Object.values(providerTraps))
      expect(trap).not.toHaveBeenCalled();
  });
});
