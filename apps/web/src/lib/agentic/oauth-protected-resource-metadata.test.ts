import { describe, expect, it } from 'vitest';
import { buildOAuthProtectedResourceMetadata } from './oauth-protected-resource-metadata';

describe('buildOAuthProtectedResourceMetadata', () => {
  it('builds protected resource metadata for the current resource host', () => {
    const metadata = buildOAuthProtectedResourceMetadata({
      baseUrl: 'https://merchant.example',
      supabaseUrl: 'https://project.supabase.co',
    });

    expect(metadata).toEqual({
      resource: 'https://merchant.example/api',
      resource_name: 'Ogabassey Agentic Commerce API',
      resource_documentation: 'https://merchant.example/auth.md',
      authorization_servers: ['https://project.supabase.co/auth/v1'],
      scopes_supported: ['openid', 'email', 'profile', 'offline_access'],
      bearer_methods_supported: ['header'],
    });
  });

  it('normalizes whitespace and trailing slashes in metadata inputs', () => {
    expect(
      buildOAuthProtectedResourceMetadata({
        baseUrl: ' https://merchant.example/// ',
        supabaseUrl: ' https://project.supabase.co/// ',
      })
    ).toMatchObject({
      resource: 'https://merchant.example/api',
      resource_documentation: 'https://merchant.example/auth.md',
      authorization_servers: ['https://project.supabase.co/auth/v1'],
    });
  });

  it('rejects malformed discovery URLs', () => {
    expect(() =>
      buildOAuthProtectedResourceMetadata({
        baseUrl: 'not-a-url',
        supabaseUrl: 'https://project.supabase.co',
      })
    ).toThrow(TypeError);
    expect(() =>
      buildOAuthProtectedResourceMetadata({
        baseUrl: 'https://merchant.example',
        supabaseUrl: '',
      })
    ).toThrow(TypeError);
  });
});
