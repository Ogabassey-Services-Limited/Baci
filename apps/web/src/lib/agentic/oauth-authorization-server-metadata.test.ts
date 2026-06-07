import { describe, expect, it } from 'vitest';
import { buildOAuthAuthorizationServerMetadata } from './oauth-authorization-server-metadata';

describe('buildOAuthAuthorizationServerMetadata', () => {
  it('builds OAuth authorization server metadata from Supabase auth', () => {
    const metadata = buildOAuthAuthorizationServerMetadata({
      baseUrl: 'https://ogabassey.com/',
      supabaseUrl: 'https://project.supabase.co/',
    });

    expect(metadata).toMatchObject({
      issuer: 'https://project.supabase.co/auth/v1',
      authorization_endpoint:
        'https://project.supabase.co/auth/v1/oauth/authorize',
      token_endpoint: 'https://project.supabase.co/auth/v1/oauth/token',
      jwks_uri: 'https://project.supabase.co/auth/v1/.well-known/jwks.json',
      userinfo_endpoint: 'https://project.supabase.co/auth/v1/oauth/userinfo',
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      service_documentation: 'https://ogabassey.com/auth.md',
    });
  });

  it('normalizes whitespace and trailing slashes in metadata inputs', () => {
    expect(
      buildOAuthAuthorizationServerMetadata({
        baseUrl: ' https://ogabassey.com/// ',
        supabaseUrl: ' https://project.supabase.co/// ',
      })
    ).toMatchObject({
      issuer: 'https://project.supabase.co/auth/v1',
      authorization_endpoint:
        'https://project.supabase.co/auth/v1/oauth/authorize',
      service_documentation: 'https://ogabassey.com/auth.md',
    });
  });

  it('rejects malformed discovery URLs', () => {
    expect(() =>
      buildOAuthAuthorizationServerMetadata({
        baseUrl: 'not-a-url',
        supabaseUrl: 'https://project.supabase.co',
      })
    ).toThrow(TypeError);
    expect(() =>
      buildOAuthAuthorizationServerMetadata({
        baseUrl: 'https://ogabassey.com',
        supabaseUrl: '',
      })
    ).toThrow(TypeError);
  });
});
