import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Edge Config
const mockEdgeGet = vi.fn();
vi.mock('@vercel/edge-config', () => ({
  get: (...args: unknown[]) => mockEdgeGet(...args),
}));

// Mock Supabase admin client (DB fallback)
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('./supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

const { getCustomDomainForSlug } = await import('./domain-cache-simple');

describe('getCustomDomainForSlug', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockEdgeGet.mockReset();
    mockMaybeSingle.mockReset();
    mockEq.mockReset().mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockSelect.mockReset().mockReturnValue({ eq: mockEq });
    mockFrom.mockReset().mockReturnValue({ select: mockSelect });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Edge Config path', () => {
    it('returns domain from Edge Config without hitting DB', async () => {
      mockEdgeGet.mockResolvedValue('ogabassey.com');

      const result = await getCustomDomainForSlug('ogabassey');

      expect(result).toBe('ogabassey.com');
      expect(mockEdgeGet).toHaveBeenCalledWith('slug_ogabassey');
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('falls back to DB when Edge Config key is missing', async () => {
      mockEdgeGet.mockResolvedValue(undefined);
      mockMaybeSingle.mockResolvedValue({
        data: {
          id: '123',
          domains: [
            {
              domain: 'fallback-from-db.com',
              is_primary: true,
              status: 'active',
              domain_type: 'custom',
            },
          ],
        },
      });

      const result = await getCustomDomainForSlug('unknown');

      expect(result).toBe('fallback-from-db.com');
      expect(mockFrom).toHaveBeenCalled();
    });
  });

  describe('DB fallback path', () => {
    beforeEach(() => {
      // Simulate Edge Config unavailable
      mockEdgeGet.mockRejectedValue(new Error('EDGE_CONFIG not set'));
    });

    it('falls back to DB when Edge Config is unavailable', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          id: '123',
          domains: [
            {
              domain: 'fallback.com',
              is_primary: true,
              status: 'active',
              domain_type: 'custom',
            },
          ],
        },
      });

      const result = await getCustomDomainForSlug('fallback-merchant');
      expect(result).toBe('fallback.com');
    });

    it('returns null when merchant has no domains', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { id: '123', domains: null },
      });

      const result = await getCustomDomainForSlug('nodomains');
      expect(result).toBeNull();
    });

    it('returns null when multiple active domains exist and none is primary', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          id: '123',
          domains: [
            {
              domain: 'example.com',
              is_primary: false,
              status: 'active',
              domain_type: 'custom',
            },
            {
              domain: 'another.com',
              is_primary: false,
              status: 'active',
              domain_type: 'purchased',
            },
            {
              domain: 'pending.com',
              is_primary: true,
              status: 'pending',
              domain_type: 'custom',
            },
          ],
        },
      });

      const result = await getCustomDomainForSlug('noprimary');
      expect(result).toBeNull();
    });

    it('returns single active custom domain when no primary exists', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          id: '123',
          domains: [
            {
              domain: 'single-active.com',
              is_primary: false,
              status: 'active',
              domain_type: 'custom',
            },
            {
              domain: 'pending.com',
              is_primary: false,
              status: 'pending',
              domain_type: 'custom',
            },
          ],
        },
      });

      const result = await getCustomDomainForSlug('singleactive');
      expect(result).toBe('single-active.com');
    });

    it('returns null when merchant does not exist', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null });

      const result = await getCustomDomainForSlug('nonexistent');
      expect(result).toBeNull();
    });

    it('returns null on database error', async () => {
      mockMaybeSingle.mockRejectedValue(new Error('DB connection failed'));

      const result = await getCustomDomainForSlug('error-slug');
      expect(result).toBeNull();
    });

    it('caches DB results within TTL', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          id: '123',
          domains: [
            {
              domain: 'cached.com',
              is_primary: true,
              status: 'active',
              domain_type: 'custom',
            },
          ],
        },
      });

      await getCustomDomainForSlug('cached-merchant');
      const callCount = mockFrom.mock.calls.length;

      // Second call should use cache
      const second = await getCustomDomainForSlug('cached-merchant');
      expect(second).toBe('cached.com');
      expect(mockFrom).toHaveBeenCalledTimes(callCount);
    });

    it('refreshes cache after TTL expires', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          id: '123',
          domains: [
            {
              domain: 'old.com',
              is_primary: true,
              status: 'active',
              domain_type: 'custom',
            },
          ],
        },
      });

      const first = await getCustomDomainForSlug('ttl-merchant');
      expect(first).toBe('old.com');

      vi.advanceTimersByTime(300_001);

      mockMaybeSingle.mockResolvedValue({
        data: {
          id: '123',
          domains: [
            {
              domain: 'new.com',
              is_primary: true,
              status: 'active',
              domain_type: 'custom',
            },
          ],
        },
      });

      const second = await getCustomDomainForSlug('ttl-merchant');
      expect(second).toBe('new.com');
    });
  });
});
