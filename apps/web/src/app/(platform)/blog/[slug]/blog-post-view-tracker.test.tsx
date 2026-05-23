import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlogPostViewTracker } from './blog-post-view-tracker';

describe('BlogPostViewTracker', () => {
  const mockFetch =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);
  });

  it('tracks views with a normalized slug', async () => {
    render(<BlogPostViewTracker slug=" Launch-Faster " />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/blog/posts?slug=launch-faster&trackView=1',
      expect.objectContaining({
        cache: 'no-store',
        keepalive: true,
        method: 'GET',
      })
    );
  });

  it('skips tracking when the slug is empty', () => {
    render(<BlogPostViewTracker slug="   " />);

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
