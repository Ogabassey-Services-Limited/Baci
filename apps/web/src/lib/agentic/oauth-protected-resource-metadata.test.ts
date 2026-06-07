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
      agent_auth: {
        skill: 'https://workos.com/auth.md',
        register_uri: 'https://merchant.example/agent/auth',
        claim_uri: 'https://merchant.example/agent/auth/claim',
        revocation_uri: 'https://merchant.example/agent/auth/revoke',
        identity_types_supported: ['identity_assertion'],
        identity_assertion: {
          assertion_types_supported: [
            'urn:ietf:params:oauth:token-type:id-jag',
          ],
          credential_types_supported: ['api_key'],
          credential_format: 'bearer_hmac',
          registration_policy: 'manual_approval',
        },
        events_supported: [
          'https://schemas.workos.com/events/agent/auth/identity/assertion/revoked',
        ],
        service_documentation: 'https://merchant.example/auth.md',
      },
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
      agent_auth: {
        register_uri: 'https://merchant.example/agent/auth',
      },
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
