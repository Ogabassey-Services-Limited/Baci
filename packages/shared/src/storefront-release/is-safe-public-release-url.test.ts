import { describe, expect, it } from 'vitest';
import { isSafePublicReleaseUrl } from './is-safe-public-release-url';

describe('isSafePublicReleaseUrl', () => {
  it.each([
    'https://example.com/contact',
    '/contact',
    '#support',
  ])('accepts the public query-free URL %s', (value) => {
    expect(isSafePublicReleaseUrl(value)).toBe(true);
  });

  it.each([
    'https://localhost/contact',
    'https://shop.local/contact',
    'https://127.0.0.1/contact',
    'https://10.0.0.1/contact',
    'https://100.64.0.1/contact',
    'https://169.254.1.1/contact',
    'https://172.16.0.1/contact',
    'https://192.168.0.1/contact',
    'https://[::1]/contact',
    'https://[fc00::1]/contact',
    'https://[fd00::1]/contact',
    'https://[fe80::1]/contact',
    'https://[febf::1]/contact',
    'https://[::]/contact',
    'https://[::ffff:7f00:1]/contact',
    'https://[::ffff:127.0.0.1]/contact',
    'https://[2001:db8::1]/contact',
    'https://metadata.google.internal/contact',
    'https://example.com/contact?token=secret',
  ])('rejects the private or unstable URL %s', (value) => {
    expect(isSafePublicReleaseUrl(value)).toBe(false);
  });
});
