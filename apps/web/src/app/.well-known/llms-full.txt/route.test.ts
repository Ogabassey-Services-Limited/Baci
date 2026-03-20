import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /.well-known/llms-full.txt', () => {
  it('returns the same storefront-oriented expanded content', async () => {
    const response = GET(
      new Request('https://ogabassey.com/.well-known/llms-full.txt', {
        headers: {
          'x-custom-domain': 'ogabassey.com',
        },
      })
    );
    const body = await response.text();

    expect(body).toContain('# Baci Storefront');
    expect(body).toContain('## Route Patterns');
  });
});
