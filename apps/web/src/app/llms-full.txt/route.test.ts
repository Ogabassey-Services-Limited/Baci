import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /llms-full.txt', () => {
  it('returns expanded platform guidance', async () => {
    const response = GET(new Request('https://usebaci.com/llms-full.txt'));
    const body = await response.text();

    expect(body).toContain('# Baci Admin');
    expect(body).toContain('Authenticated routes such as `/dashboard`');
    expect(body).toContain('/.well-known/llms.txt');
    expect(body).toContain('/pricing.md');
  });

  it('returns expanded storefront guidance', async () => {
    const response = GET(
      new Request('https://ogabassey.com/llms-full.txt', {
        headers: {
          'x-custom-domain': 'ogabassey.com',
        },
      })
    );
    const body = await response.text();

    expect(body).toContain('# Baci Storefront');
    expect(body).toContain('Do not trigger live checkout submissions');
    expect(body).toContain('Use the current host as canonical');
    expect(body).toContain('/faq.md');
  });
});
