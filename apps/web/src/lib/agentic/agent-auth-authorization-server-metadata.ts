import { buildAgentAuthIssuer } from './agent-auth-issuer';
import { buildAgentAuthMetadata } from './agent-auth-metadata';
import { normalizeBaseUrl } from './normalize-base-url';

const AGENT_AUTH_SCOPES = [
  'agent:catalog:read',
  'agent:checkout:write',
] as const;

export function buildAgentAuthAuthorizationServerMetadata(baseUrl: string) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  return {
    issuer: buildAgentAuthIssuer(normalizedBaseUrl),
    scopes_supported: [...AGENT_AUTH_SCOPES],
    bearer_methods_supported: ['header'],
    service_documentation: `${normalizedBaseUrl}/auth.md`,
    agent_auth: buildAgentAuthMetadata(normalizedBaseUrl),
  };
}
