import { describe, expect, it, vi } from 'vitest';
import { buildCuratedStorefront } from '@/lib/storefront-defaults/build-curated-storefront';
import { generateInitialTemplate } from './initial-template-generator';

const dependencyTraps = vi.hoisted(() => ({
  google: vi.fn(() => {
    throw new Error('Google provider must not run');
  }),
  cerebras: vi.fn(() => {
    throw new Error('Cerebras provider must not run');
  }),
  groq: vi.fn(() => {
    throw new Error('Groq provider must not run');
  }),
  openAICompatible: vi.fn(() => {
    throw new Error('OpenAI-compatible provider must not run');
  }),
  cookies: vi.fn(() => {
    throw new Error('cookies must not run');
  }),
  serverSupabase: vi.fn(() => {
    throw new Error('server Supabase must not run');
  }),
  browserSupabase: vi.fn(() => {
    throw new Error('browser Supabase must not run');
  }),
  adminSupabase: vi.fn(() => {
    throw new Error('admin Supabase must not run');
  }),
  serviceSupabase: vi.fn(() => {
    throw new Error('service Supabase must not run');
  }),
  publicSupabase: vi.fn(() => {
    throw new Error('public Supabase must not run');
  }),
  anonSupabase: vi.fn(() => {
    throw new Error('anon Supabase must not run');
  }),
  fetch: vi.fn(() => {
    throw new Error('fetch must not run');
  }),
}));

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: dependencyTraps.google,
}));
vi.mock('@ai-sdk/cerebras', () => ({
  createCerebras: dependencyTraps.cerebras,
}));
vi.mock('@ai-sdk/groq', () => ({ createGroq: dependencyTraps.groq }));
vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: dependencyTraps.openAICompatible,
}));
vi.mock('next/headers', () => ({ cookies: dependencyTraps.cookies }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: dependencyTraps.serverSupabase,
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: dependencyTraps.browserSupabase,
}));
vi.mock('@/lib/supabase/admin', () => ({
  createClient: dependencyTraps.adminSupabase,
  createAdminClient: dependencyTraps.adminSupabase,
}));
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: dependencyTraps.serviceSupabase,
}));
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: dependencyTraps.publicSupabase,
}));
vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: dependencyTraps.anonSupabase,
}));

const input = {
  businessName: 'CarePoint',
  businessType: 'pharmaceuticals',
  brandColors: { primary: '#0f766e', background: '#ffffff', accent: '#22c55e' },
  merchant: {
    logo_url: 'https://example.com/logo.png',
    hero_image_ids: ['ignored'],
  },
};

describe('generateInitialTemplate', () => {
  it('keeps frozen starter inputs isolated from all configured runtime dependencies', async () => {
    const frozenInput = Object.freeze({
      businessName: 'CarePoint',
      businessType: 'pharmaceuticals',
      brandColors: Object.freeze({
        primary: '#0f766e',
        background: '#ffffff',
        accent: '#22c55e',
      }),
      merchant: Object.freeze({
        logo_url: 'https://example.com/logo.png',
        hero_image_ids: Object.freeze(['ignored']),
      }),
    });
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('clock must not run');
    });
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('random must not run');
    });
    vi.stubGlobal('fetch', dependencyTraps.fetch);

    try {
      const first = await generateInitialTemplate(frozenInput);
      const second = await generateInitialTemplate(frozenInput);
      const direct = buildCuratedStorefront({
        businessName: 'CarePoint',
        businessType: 'pharmaceuticals',
        country: '',
        brandColors: frozenInput.brandColors,
        logoUrl: 'https://example.com/logo.png',
      });

      expect(first).toEqual(second);
      expect(first).toEqual(direct);
      expect(frozenInput).toEqual({
        businessName: 'CarePoint',
        businessType: 'pharmaceuticals',
        brandColors: {
          primary: '#0f766e',
          background: '#ffffff',
          accent: '#22c55e',
        },
        merchant: {
          logo_url: 'https://example.com/logo.png',
          hero_image_ids: ['ignored'],
        },
      });
      for (const trap of Object.values(dependencyTraps))
        expect(trap).not.toHaveBeenCalled();
      expect(clock).not.toHaveBeenCalled();
      expect(random).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
      random.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('does not call configured AI providers while creating a starter', async () => {
    const provider = vi.fn(() => {
      throw new Error('provider must not run');
    });
    vi.stubGlobal('fetch', provider);
    const result = await generateInitialTemplate(input);
    expect(
      result.content.find((block) => block.type === 'Hero')?.props?.headingLevel
    ).toBe('h1');
    expect(provider).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it('does not read clocks or random values while creating a starter', async () => {
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('clock must not run');
    });
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('random must not run');
    });

    await expect(generateInitialTemplate(input)).resolves.toEqual(
      await generateInitialTemplate(input)
    );

    expect(clock).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
    clock.mockRestore();
    random.mockRestore();
  });
  it.each([
    'fashion',
    'food',
    'electronics',
    'pharmacy',
    'unknown-type',
  ])('returns stable unique scaffold IDs for %s', async (businessType) => {
    const result = await generateInitialTemplate({
      ...input,
      businessType,
      merchant: { logo_url: 'invalid' },
    });
    const ids = result.content.map((block) => block.props?.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      result.content.filter((block) => block.type === 'Header')
    ).toHaveLength(1);
    expect(
      result.content.filter((block) => block.type === 'Footer')
    ).toHaveLength(1);
    expect(
      result.content.filter((block) => block.type === 'ProductGrid')
    ).toHaveLength(1);
    expect(
      result.content.find((block) => block.type === 'Header')?.props?.logoUrl
    ).toBeUndefined();
  });
});
