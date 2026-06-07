import { normalizeBaseUrl } from './normalize-base-url';

const AGENT_AUTH_ISSUER_PATH = '/agent-auth/v1';

export function buildAgentAuthIssuer(baseUrl: string): string {
  return new URL(AGENT_AUTH_ISSUER_PATH, `${normalizeBaseUrl(baseUrl)}/`)
    .toString()
    .replace(/\/+$/, '');
}
