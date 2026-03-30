export const BACI_ADMIN_SCHEME = 'baciadmin';
export const JUMIA_MOBILE_RETURN_PATH = '/sales-channels';

type QueryValue = boolean | number | string | null | undefined;

function normalizeAppPath(path: string): string {
  const trimmedPath = path.trim().replace(/^\/+/, '');
  return `/${trimmedPath}`;
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
  const url = new URL(`${BACI_ADMIN_SCHEME}://${normalizeAppPath(path)}`);
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
