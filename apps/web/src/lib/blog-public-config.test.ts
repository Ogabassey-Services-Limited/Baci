import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getPublicBlogMediaCdnOrigin,
  getPublicRootDomain,
} from '@/lib/blog-public-config';

const publicConfigSource = readFileSync(
  path.resolve(process.cwd(), 'src/lib/blog-public-config.ts'),
  'utf8'
);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('blog public config', () => {
  it('reads only the public values required by browser-reachable blog modules', () => {
    vi.stubEnv(
      'NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN',
      'https://media.example.com'
    );
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'stores.example.com');

    expect(getPublicBlogMediaCdnOrigin()).toBe('https://media.example.com');
    expect(getPublicRootDomain()).toBe('stores.example.com');
  });

  it('does not import the server environment module or expose secret accessors', () => {
    expect(publicConfigSource).not.toMatch(/from\s+['"]@\/env['"]/);
    expect(publicConfigSource).not.toContain('getSupabaseServiceRoleKey');
    expect(publicConfigSource).not.toContain('getInternalApiSecret');
  });
});
