import { describe, expect, it } from 'vitest';
import { getPostHogTracingHeaderHostnames } from './tracing-hostnames';

describe('PostHog tracing hostnames', () => {
  it('limits tracing headers to Baci production hostnames', () => {
    expect(
      getPostHogTracingHeaderHostnames(
        { NEXT_PUBLIC_ROOT_DOMAIN: 'usebaci.com' },
        { hostname: 'www.ogabassey.com' }
      )
    ).toEqual([
      'usebaci.com',
      'www.usebaci.com',
      'www.ogabassey.com',
      'ogabassey.com',
    ]);
  });

  it('excludes local and Vercel preview hostnames', () => {
    expect(
      getPostHogTracingHeaderHostnames(
        {
          NEXT_PUBLIC_ROOT_DOMAIN: 'usebaci.com',
          NEXT_PUBLIC_VERCEL_ENV: 'preview',
        },
        { hostname: 'baci-git-main.vercel.app' }
      )
    ).toEqual(['usebaci.com', 'www.usebaci.com']);
  });

  it('keeps Vercel production hostnames when production is explicit', () => {
    expect(
      getPostHogTracingHeaderHostnames(
        {
          NEXT_PUBLIC_ROOT_DOMAIN: 'usebaci.com',
          NEXT_PUBLIC_VERCEL_ENV: 'production',
        },
        { hostname: 'baci-git-main.vercel.app' }
      )
    ).toEqual(['usebaci.com', 'www.usebaci.com', 'baci-git-main.vercel.app']);
  });

  it('normalizes www root domains before adding the www variant', () => {
    expect(
      getPostHogTracingHeaderHostnames(
        { NEXT_PUBLIC_ROOT_DOMAIN: 'www.usebaci.com' },
        { hostname: 'usebaci.com' }
      )
    ).toEqual(['usebaci.com', 'www.usebaci.com']);
  });

  it('drops malformed absolute URL hostnames', () => {
    expect(
      getPostHogTracingHeaderHostnames(
        { NEXT_PUBLIC_ROOT_DOMAIN: 'https://:443' },
        { hostname: 'ogabassey.com' }
      )
    ).toEqual(['usebaci.com', 'www.usebaci.com', 'ogabassey.com']);
  });

  it('drops malformed bare and relative hostnames', () => {
    expect(
      getPostHogTracingHeaderHostnames(
        { NEXT_PUBLIC_ROOT_DOMAIN: 'foo bar' },
        { hostname: '/api' }
      )
    ).toEqual(['usebaci.com', 'www.usebaci.com']);
  });
});
