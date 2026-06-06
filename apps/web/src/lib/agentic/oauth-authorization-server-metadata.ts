const OAUTH_SCOPES = ['openid', 'email', 'profile', 'offline_access'] as const;
const OAUTH_RESPONSE_TYPES = ['code'] as const;
const OAUTH_GRANT_TYPES = ['authorization_code', 'refresh_token'] as const;

function normalizeBaseUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  const parsedUrl = new URL(normalizedBaseUrl);

  return parsedUrl.toString().replace(/\/+$/, '');
}

function buildSupabaseIssuer(supabaseUrl: string): string {
  return new URL('/auth/v1', normalizeBaseUrl(supabaseUrl)).toString();
}

function buildSupabaseOAuthEndpoint(supabaseUrl: string, pathname: string) {
  return new URL(pathname, normalizeBaseUrl(supabaseUrl)).toString();
}

export function buildOAuthAuthorizationServerMetadata({
  baseUrl,
  supabaseUrl,
}: {
  baseUrl: string;
  supabaseUrl: string;
}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const issuer = buildSupabaseIssuer(supabaseUrl);

  return {
    issuer,
    authorization_endpoint: buildSupabaseOAuthEndpoint(
      supabaseUrl,
      '/auth/v1/oauth/authorize'
    ),
    token_endpoint: buildSupabaseOAuthEndpoint(
      supabaseUrl,
      '/auth/v1/oauth/token'
    ),
    userinfo_endpoint: buildSupabaseOAuthEndpoint(
      supabaseUrl,
      '/auth/v1/oauth/userinfo'
    ),
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    response_types_supported: [...OAUTH_RESPONSE_TYPES],
    grant_types_supported: [...OAUTH_GRANT_TYPES],
    scopes_supported: [...OAUTH_SCOPES],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['ES256', 'RS256'],
    token_endpoint_auth_methods_supported: [
      'client_secret_basic',
      'client_secret_post',
      'none',
    ],
    code_challenge_methods_supported: ['S256'],
    service_documentation: `${normalizedBaseUrl}/auth.md`,
  };
}
