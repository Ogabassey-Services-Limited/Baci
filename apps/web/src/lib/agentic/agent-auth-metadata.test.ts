import { describe, expect, it } from 'vitest';
import { buildAgentAuthMetadata } from './agent-auth-metadata';

describe('buildAgentAuthMetadata', () => {
  it('builds Auth.md agent registration metadata for the current host', () => {
    expect(buildAgentAuthMetadata('https://merchant.example/')).toEqual({
      skill: 'https://workos.com/auth.md',
      register_uri: 'https://merchant.example/.well-known/agent-auth',
      claim_uri: 'https://merchant.example/.well-known/agent-auth/claim',
      revocation_uri: 'https://merchant.example/.well-known/agent-auth/revoke',
      identity_types_supported: ['identity_assertion'],
      identity_assertion: {
        assertion_types_supported: ['urn:ietf:params:oauth:token-type:id-jag'],
        credential_types_supported: ['api_key'],
        credential_format: 'bearer_hmac',
        registration_policy: 'manual_approval',
      },
      events_supported: [
        'https://schemas.workos.com/events/agent/auth/identity/assertion/revoked',
      ],
      service_documentation: 'https://merchant.example/auth.md',
    });
  });

  it('normalizes whitespace and trailing slashes', () => {
    const metadata = buildAgentAuthMetadata(' https://merchant.example/// ');

    expect(metadata.register_uri).toBe(
      'https://merchant.example/.well-known/agent-auth'
    );
    expect(metadata.service_documentation).toBe(
      'https://merchant.example/auth.md'
    );
  });

  it('rejects malformed base URLs', () => {
    expect(() => buildAgentAuthMetadata('not-a-url')).toThrow(TypeError);
  });
});
