import { describe, expect, it } from 'vitest';
import {
  buildOAuthAuthorizationServerMetadata,
  buildOAuthProtectedResourceMetadata,
} from './oauth-discovery';

describe('oauth-discovery', () => {
  it('builds OAuth authorization server metadata from Supabase auth', () => {
    const metadata = buildOAuthAuthorizationServerMetadata({
      baseUrl: 'https://ogabassey.com/',
      supabaseUrl: 'https://project.supabase.co/',
    });

    expect(metadata).toMatchObject({
      issuer: 'https://project.supabase.co/auth/v1',
      authorization_endpoint: 'https://project.supabase.co/auth/v1/authorize',
      token_endpoint: 'https://project.supabase.co/auth/v1/token',
      jwks_uri: 'https://project.supabase.co/auth/v1/.well-known/jwks.json',
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      service_documentation: 'https://ogabassey.com/auth.md',
    });
  });

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
});
