import { describe, expect, it } from 'vitest';
import { buildAgentAuthAuthorizationServerMetadata } from './agent-auth-authorization-server-metadata';

describe('buildAgentAuthAuthorizationServerMetadata', () => {
  it('builds Auth.md authorization server metadata for the current host', () => {
    expect(
      buildAgentAuthAuthorizationServerMetadata('https://merchant.example/')
    ).toMatchObject({
      issuer: 'https://merchant.example/agent-auth/v1',
      scopes_supported: ['agent:catalog:read', 'agent:checkout:write'],
      bearer_methods_supported: ['header'],
      service_documentation: 'https://merchant.example/auth.md',
      agent_auth: {
        register_uri: 'https://merchant.example/.well-known/agent-auth',
        claim_uri: 'https://merchant.example/.well-known/agent-auth/claim',
        revocation_uri:
          'https://merchant.example/.well-known/agent-auth/revoke',
        identity_types_supported: ['identity_assertion'],
      },
    });
  });

  it('normalizes whitespace and trailing slashes', () => {
    expect(
      buildAgentAuthAuthorizationServerMetadata(' https://merchant.example/// ')
    ).toMatchObject({
      issuer: 'https://merchant.example/agent-auth/v1',
      service_documentation: 'https://merchant.example/auth.md',
    });
  });

  it('rejects malformed base URLs', () => {
    expect(() =>
      buildAgentAuthAuthorizationServerMetadata('not-a-url')
    ).toThrow(TypeError);
  });
});
