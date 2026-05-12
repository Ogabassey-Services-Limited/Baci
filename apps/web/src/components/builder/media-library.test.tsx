import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: vi.fn(() => ({
    merchant: { id: 'm-1', slug: 'test' },
    loading: false,
  })),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        list: vi.fn(() => ({ data: [], error: null })),
        upload: vi.fn(),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })),
      })),
    },
  })),
}));

import { MediaLibrary } from './media-library';

describe('MediaLibrary', () => {
  it('exports a valid component', () => {
    expect(MediaLibrary).toBeDefined();
    expect(typeof MediaLibrary).toBe('function');
  });
});
