import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /index.html.md', () => {
  it('returns platform markdown', async () => {
    const response = GET(new Request('https://usebaci.com/index.html.md'));
    const body = await response.text();

    expect(response.headers.get('content-type')).toContain('text/markdown');
    expect(body).toContain('# Baci');
    expect(body).toContain('https://usebaci.com/onboarding');
  });
});
