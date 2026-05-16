import { describe, expect, it, vi } from 'vitest';

const { mockImage } = vi.hoisted(() => ({
  mockImage: vi.fn(),
}));

vi.mock('../opengraph-image-renderer', () => ({
  default: (props: unknown) => mockImage(props),
  runtime: 'nodejs',
}));

import { GET, runtime } from './route';

describe('explicit merchant blog social image route', () => {
  it('delegates to the merchant blog OG image renderer with route params', async () => {
    const response = new Response('png', {
      headers: { 'content-type': 'image/png' },
    });
    const params = Promise.resolve({
      slug: 'ogabassey.com',
      postSlug: 'airpods-max',
    });
    mockImage.mockResolvedValue(response);

    await expect(
      GET(
        new Request('https://ogabassey.com/blog/airpods-max/opengraph-image'),
        {
          params,
        }
      )
    ).resolves.toBe(response);

    expect(runtime).toBe('nodejs');
    expect(mockImage).toHaveBeenCalledWith({ params });
  });
});
