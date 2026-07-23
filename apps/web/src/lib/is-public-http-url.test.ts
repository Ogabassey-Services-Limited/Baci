import { lookup } from 'node:dns/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isPublicHttpUrl } from './is-public-http-url';

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));
vi.mock('node:dns/promises', () => ({
  default: { lookup: lookupMock },
  lookup: lookupMock,
}));

function resolvesTo(...addresses: string[]) {
  vi.mocked(lookup).mockResolvedValue(
    addresses.map((address) => ({
      address,
      family: address.includes(':') ? 6 : 4,
    })) as unknown as ReturnType<typeof lookup> extends Promise<infer T>
      ? T
      : never
  );
}

beforeEach(() => {
  vi.mocked(lookup).mockReset();
  vi.stubEnv('NODE_ENV', 'production');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isPublicHttpUrl (production)', () => {
  it('allows an https host that resolves to a public address', async () => {
    resolvesTo('93.184.216.34');

    await expect(
      isPublicHttpUrl(new URL('https://cdn.example.com/logo.png'))
    ).resolves.toBe(true);
  });

  it('rejects a non-http(s) scheme', async () => {
    await expect(isPublicHttpUrl(new URL('file:///etc/passwd'))).resolves.toBe(
      false
    );
    await expect(
      isPublicHttpUrl(new URL('gopher://example.com'))
    ).resolves.toBe(false);
  });

  it('rejects plaintext http in production', async () => {
    resolvesTo('93.184.216.34');

    await expect(
      isPublicHttpUrl(new URL('http://cdn.example.com/logo.png'))
    ).resolves.toBe(false);
  });

  it('rejects the cloud metadata endpoint by literal IP', async () => {
    await expect(
      isPublicHttpUrl(new URL('https://169.254.169.254/latest/meta-data/'))
    ).resolves.toBe(false);
  });

  it('rejects a hostname that RESOLVES to the metadata endpoint', async () => {
    resolvesTo('169.254.169.254');

    await expect(
      isPublicHttpUrl(new URL('https://evil.example.com/logo.png'))
    ).resolves.toBe(false);
  });

  it.each([
    'https://127.0.0.1/logo.png',
    'https://10.1.2.3/logo.png',
    'https://172.16.0.1/logo.png',
    'https://192.168.1.1/logo.png',
    'https://100.64.0.1/logo.png',
    'https://0.0.0.0/logo.png',
  ])('rejects the private literal IP in %j', async (url) => {
    await expect(isPublicHttpUrl(new URL(url))).resolves.toBe(false);
  });

  it.each([
    'https://[::1]/logo.png',
    'https://[fe80::1]/logo.png',
    'https://[fd00::1]/logo.png',
    'https://[::ffff:127.0.0.1]/logo.png',
  ])('rejects the private IPv6 literal in %j', async (url) => {
    await expect(isPublicHttpUrl(new URL(url))).resolves.toBe(false);
  });

  it('rejects a host that resolves to BOTH a public and a private address', async () => {
    resolvesTo('93.184.216.34', '10.0.0.5');

    await expect(
      isPublicHttpUrl(new URL('https://split-horizon.example.com/logo.png'))
    ).resolves.toBe(false);
  });

  it('rejects a host that fails to resolve', async () => {
    vi.mocked(lookup).mockRejectedValue(new Error('ENOTFOUND'));

    await expect(
      isPublicHttpUrl(new URL('https://nonexistent.example.com/logo.png'))
    ).resolves.toBe(false);
  });

  it('rejects a host that resolves to nothing', async () => {
    resolvesTo();

    await expect(
      isPublicHttpUrl(new URL('https://empty.example.com/logo.png'))
    ).resolves.toBe(false);
  });
});

describe('isPublicHttpUrl (development)', () => {
  it('allows loopback so a local Supabase/storage stack keeps working', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    await expect(
      isPublicHttpUrl(new URL('http://127.0.0.1:54321/storage/logo.png'))
    ).resolves.toBe(true);
  });

  it('still rejects a non-http(s) scheme outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    await expect(isPublicHttpUrl(new URL('file:///etc/passwd'))).resolves.toBe(
      false
    );
  });
});
