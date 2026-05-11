export const BACI_ADMIN_SCHEME = 'baciadmin';
export const JUMIA_MOBILE_RETURN_PATH = '/sales-channels';
export const JUMIA_MOBILE_RETURN_ROUTE = 'sales-channels';

/**
 * Closed allow-list of mobile deep-link schemes that the web tier is permitted
 * to issue redirects to. New schemes must be added here intentionally and code
 * reviewed — never derive from request input or environment.
 *
 * Security: this is the trust anchor for {@link createBaciAdminUrl}. Without
 * it, an attacker who could influence `path` could embed `//host/` segments
 * that change the URL authority. The runtime assert below is defence-in-depth.
 */
const ALLOWED_DEEP_LINK_SCHEMES: ReadonlySet<string> = new Set([
  BACI_ADMIN_SCHEME,
]);

type QueryValue = boolean | number | string | null | undefined;

function normalizeRouteSegments(path: string): string[] {
  return path
    .trim()
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function applyQueryParams(url: URL, query?: Record<string, QueryValue>): URL {
  if (!query) {
    return url;
  }

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  return url;
}

export function createBaciAdminUrl(
  path: string,
  query?: Record<string, QueryValue>
): URL {
  const segments = normalizeRouteSegments(path);
  const baseUrl =
    segments.length > 0
      ? `${BACI_ADMIN_SCHEME}://${segments.join('/')}`
      : `${BACI_ADMIN_SCHEME}:///`;
  const url = new URL(baseUrl);

  // Defense-in-depth: verify the parsed protocol still matches the constant
  // scheme. `URL` lowercases and validates the scheme; if anything ever
  // smuggles in `//other-host` style segments the protocol would change.
  // Throwing here closes the open-redirect vector at the construction site.
  const expectedProtocol = `${BACI_ADMIN_SCHEME}:`;
  if (
    url.protocol !== expectedProtocol ||
    !ALLOWED_DEEP_LINK_SCHEMES.has(url.protocol.replace(/:$/, ''))
  ) {
    throw new Error(
      `Refusing to build deep-link URL with non-allow-listed scheme: ${url.protocol}`
    );
  }

  return applyQueryParams(url, query);
}

export function buildBaciAdminUrl(
  path: string,
  query?: Record<string, QueryValue>
): string {
  return createBaciAdminUrl(path, query).toString();
}

export const JUMIA_MOBILE_RETURN_URL = buildBaciAdminUrl(
  JUMIA_MOBILE_RETURN_PATH
);

export function createJumiaMobileReturnUrl(
  query?: Record<string, QueryValue>
): URL {
  return createBaciAdminUrl(JUMIA_MOBILE_RETURN_PATH, query);
}

export function buildJumiaMobileReturnUrl(
  query?: Record<string, QueryValue>
): string {
  return createJumiaMobileReturnUrl(query).toString();
}
