import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const headersMock = vi.fn();

vi.mock('next/headers', () => ({
  headers: headersMock,
}));

describe('getRequestUrlContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the current public host without a slug prefix', async () => {
    headersMock.mockResolvedValue(new Headers([['host', 'ogabassey.com']]));

    const { getRequestUrlContext } = await import('./url-context');
    const result = await getRequestUrlContext('ogabassey.com');

    expect(result).toEqual({
      basePath: '',
      baseUrl: 'https://ogabassey.com',
      host: 'ogabassey.com',
      isLocalhost: false,
    });
  });

  it('adds the slug prefix when serving from localhost', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    headersMock.mockResolvedValue(new Headers([['host', 'localhost:3000']]));

    const { getRequestUrlContext } = await import('./url-context');
    const result = await getRequestUrlContext('ogabassey');

    expect(result).toEqual({
      basePath: '/ogabassey',
      baseUrl: 'http://localhost:3000',
      host: 'localhost:3000',
      isLocalhost: true,
    });
  });

  it('falls back to the merchant subdomain when the host header is missing', async () => {
    headersMock.mockResolvedValue(new Headers());

    const { getRequestUrlContext } = await import('./url-context');
    const result = await getRequestUrlContext('ogabassey');

    expect(result).toEqual({
      basePath: '',
      baseUrl: 'https://ogabassey.usebaci.com',
      host: 'ogabassey.usebaci.com',
      isLocalhost: false,
    });
  });
});
