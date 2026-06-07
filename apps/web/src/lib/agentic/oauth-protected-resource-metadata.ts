const OAUTH_SCOPES = ['openid', 'email', 'profile', 'offline_access'] as const;

function normalizeBaseUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  const parsedUrl = new URL(normalizedBaseUrl);

  return parsedUrl.toString().replace(/\/+$/, '');
}

function buildSupabaseIssuer(supabaseUrl: string): string {
  return new URL('/auth/v1', normalizeBaseUrl(supabaseUrl)).toString();
}

export function buildOAuthProtectedResourceMetadata({
  baseUrl,
  supabaseUrl,
}: {
  baseUrl: string;
  supabaseUrl: string;
}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const authorizationServer = buildSupabaseIssuer(supabaseUrl);

  return {
    resource: `${normalizedBaseUrl}/api`,
    resource_name: 'Ogabassey Agentic Commerce API',
    resource_documentation: `${normalizedBaseUrl}/auth.md`,
    authorization_servers: [authorizationServer],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ['header'],
  };
}
