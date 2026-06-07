import { buildAgentAuthIssuer } from './agent-auth-issuer';
import { buildAgentAuthMetadata } from './agent-auth-metadata';
import { normalizeBaseUrl } from './normalize-base-url';

const AGENT_AUTH_SCOPES = [
  'agent:catalog:read',
  'agent:checkout:write',
] as const;

export function buildOAuthProtectedResourceMetadata({
  baseUrl,
}: {
  baseUrl: string;
}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  return {
    resource: `${normalizedBaseUrl}/api`,
    resource_name: 'Ogabassey Agentic Commerce API',
    resource_documentation: `${normalizedBaseUrl}/auth.md`,
    authorization_servers: [buildAgentAuthIssuer(normalizedBaseUrl)],
    scopes_supported: [...AGENT_AUTH_SCOPES],
    bearer_methods_supported: ['header'],
    agent_auth: buildAgentAuthMetadata(normalizedBaseUrl),
  };
}
