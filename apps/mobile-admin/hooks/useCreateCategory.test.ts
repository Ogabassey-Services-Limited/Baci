import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MutationConfig {
  mutationFn?: (variables: unknown) => unknown;
}

/** Captures each useMutation config so the mutationFn can be invoked directly. */
const mutationConfigs: MutationConfig[] = [];

vi.mock('@tanstack/react-query', () => ({
  useMutation: (config: MutationConfig) => {
    mutationConfigs.push(config);
    return {};
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
}));

// Importing api-client for real pulls RN transport internals the test
// environment cannot load ("Cannot read properties of undefined (EventEmitter)").
vi.mock('@/lib/api-client', () => ({
  apiClient: vi.fn().mockResolvedValue({
    category: { id: 'category-1', name: 'Phones', slug: 'phones' },
  }),
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeText: (value: string, max: number) => value.slice(0, max),
}));

describe('useCreateCategory slug generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Named `use*` so the hook call inside satisfies the rules-of-hooks lint,
  // matching how the suite already calls useProducts() directly.
  async function useCategoryCreate(name: string) {
    const { useCreateCategory } = await import('./useCreateCategory');
    // The useMutation mock records each config; the last one is this hook's.
    mutationConfigs.length = 0;
    useCreateCategory();
    const config = mutationConfigs.at(-1);
    if (!config?.mutationFn) throw new Error('mutationFn not registered');
    return config.mutationFn(name);
  }

  it('posts a route-compatible slug derived from the name', async () => {
    const { apiClient } = await import('@/lib/api-client');

    await useCategoryCreate('Mobile Phones');

    expect(apiClient).toHaveBeenCalledWith(
      '/api/merchant/categories',
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse(
      (vi.mocked(apiClient).mock.calls[0]?.[1] as { body: string }).body
    );
    expect(body.slug).toBe('mobile-phones');
  });

  describe('bugfix: names with no ASCII characters produced an empty slug', () => {
    it('fails locally with an actionable message instead of POSTing a 400', async () => {
      const { apiClient } = await import('@/lib/api-client');

      // The old inline generator turned 手机 into '' and the route answered 400.
      await expect(useCategoryCreate('手机')).rejects.toThrow(
        /letters or numbers/i
      );
      expect(apiClient).not.toHaveBeenCalled();
    });

    it('bounds a very long name to the slug maximum the route accepts', async () => {
      const { apiClient } = await import('@/lib/api-client');

      await useCategoryCreate(`${'word '.repeat(60)}end`);

      const body = JSON.parse(
        (vi.mocked(apiClient).mock.calls[0]?.[1] as { body: string }).body
      );
      expect(body.slug.length).toBeLessThanOrEqual(120);
      expect(body.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    });
  });
});
