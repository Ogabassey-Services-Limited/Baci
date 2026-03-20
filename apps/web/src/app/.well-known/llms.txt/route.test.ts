import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /.well-known/llms.txt', () => {
  it('returns the same platform-oriented content', async () => {
    const response = GET(
      new Request('https://usebaci.com/.well-known/llms.txt')
    );
    const body = await response.text();

    expect(body).toContain('# Baci Admin');
    expect(response.headers.get('content-type')).toContain('text/markdown');
  });
});
