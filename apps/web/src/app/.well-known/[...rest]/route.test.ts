import { describe, expect, it } from 'vitest';

import { GET } from './route';

describe('GET /.well-known/[...rest]', () => {
  it('returns 404 for unsupported traffic advice probes', async () => {
    const response = GET();

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(response.headers.get('cache-control')).toContain('max-age=300');
    expect(response.headers.get('cache-control')).toContain('s-maxage=300');
    await expect(response.text()).resolves.toBe('Not Found');
  });

  it('returns 404 for unknown well-known entries', async () => {
    const response = GET();

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe('Not Found');
  });
});
