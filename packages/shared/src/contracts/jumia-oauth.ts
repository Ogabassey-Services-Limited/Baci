export const BACI_ADMIN_SCHEME = 'baciadmin';
export const JUMIA_MOBILE_RETURN_PATH = '/sales-channels';
export const JUMIA_MOBILE_RETURN_ROUTE = 'sales-channels';

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
  //
  // If a second deep-link scheme is added in the future, replace this strict
  // equality check with an allow-list set (e.g. `new Set([baciadmin, foo])`).
  const expectedProtocol = `${BACI_ADMIN_SCHEME}:`;
  if (url.protocol !== expectedProtocol) {
    throw new Error(
      `Refusing to build deep-link URL with unexpected scheme: ${url.protocol} (expected ${expectedProtocol})`
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
