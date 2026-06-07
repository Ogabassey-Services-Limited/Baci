import { normalizeBaseUrl } from './normalize-base-url';

const AUTH_MD_SKILL_URL = 'https://workos.com/auth.md';
const IDENTITY_ASSERTION_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:id-jag';
const AGENT_AUTH_REVOCATION_EVENT =
  'https://schemas.workos.com/events/agent/auth/identity/assertion/revoked';

export function buildAgentAuthMetadata(baseUrl: string) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  return {
    skill: AUTH_MD_SKILL_URL,
    register_uri: `${normalizedBaseUrl}/.well-known/agent-auth`,
    claim_uri: `${normalizedBaseUrl}/.well-known/agent-auth/claim`,
    revocation_uri: `${normalizedBaseUrl}/.well-known/agent-auth/revoke`,
    identity_types_supported: ['identity_assertion'],
    identity_assertion: {
      assertion_types_supported: [IDENTITY_ASSERTION_TOKEN_TYPE],
      credential_types_supported: ['api_key'],
      credential_format: 'bearer_hmac',
      registration_policy: 'manual_approval',
    },
    events_supported: [AGENT_AUTH_REVOCATION_EVENT],
    service_documentation: `${normalizedBaseUrl}/auth.md`,
  };
}
