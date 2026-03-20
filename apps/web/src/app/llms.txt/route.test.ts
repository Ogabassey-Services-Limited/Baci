import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /llms.txt', () => {
  it('returns platform content on the root domain', async () => {
    const response = GET(new Request('https://usebaci.com/llms.txt'));
    const body = await response.text();

    expect(response.headers.get('content-type')).toContain('text/markdown');
    expect(body).toContain('# Baci Admin');
    expect(body).toContain('## Authenticated');
    expect(body).toContain('/index.html.md');
  });

  it('returns storefront content when merchant headers are present', async () => {
    const response = GET(
      new Request('https://preview.vercel.app/llms.txt', {
        headers: {
          'x-merchant-slug': 'ogabassey',
        },
      })
    );
    const body = await response.text();

    expect(body).toContain('# Baci Storefront');
    expect(body).toContain('/cart');
    expect(body).toContain('## Read-Only Guidance');
    expect(body).toContain('/about.md');
  });
});
