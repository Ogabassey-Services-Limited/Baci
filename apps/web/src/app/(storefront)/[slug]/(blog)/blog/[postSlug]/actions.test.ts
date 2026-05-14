import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCookies, mockCreateClient, mockRpc } = vi.hoisted(() => ({
  mockCookies: vi.fn(async () => ({})),
  mockCreateClient: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

import { incrementViewCount } from './actions';

describe('incrementViewCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the increment_blog_post_views rpc with the post id', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockCreateClient.mockReturnValue({
      rpc: mockRpc,
    });

    await incrementViewCount('post-123');

    expect(mockRpc).toHaveBeenCalledWith('increment_blog_post_views', {
      p_post_id: 'post-123',
    });
  });

  it('logs returned rpc errors without throwing', async () => {
    const error = new Error('rpc failed');
    const consoleSpy = vi
      .spyOn(console, 'error')
      // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress expected test logging
      .mockImplementation(() => {});

    mockRpc.mockResolvedValue({ data: null, error });
    mockCreateClient.mockReturnValue({
      rpc: mockRpc,
    });

    await expect(incrementViewCount('post-123')).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to increment view count:',
      error
    );

    consoleSpy.mockRestore();
  });

  it('does not call supabase when the post id is invalid', async () => {
    await incrementViewCount('   ');

    expect(mockCookies).not.toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
