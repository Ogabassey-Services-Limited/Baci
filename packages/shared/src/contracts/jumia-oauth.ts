export const BACI_ADMIN_SCHEME = 'baciadmin';
export const JUMIA_MOBILE_RETURN_PATH = '/sales-channels';

type QueryValue = boolean | number | string | null | undefined;

function normalizeAppPath(path: string): string {
  const trimmedPath = path.trim().replace(/^\/+/, '');
  return `/${trimmedPath}`;
}

export function buildBaciAdminUrl(
  path: string,
  query?: Record<string, QueryValue>
): string {
  const url = new URL(`${BACI_ADMIN_SCHEME}://${normalizeAppPath(path)}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

export const JUMIA_MOBILE_RETURN_URL = buildBaciAdminUrl(
  JUMIA_MOBILE_RETURN_PATH
);

export function buildJumiaMobileReturnUrl(
  query?: Record<string, QueryValue>
): string {
  return buildBaciAdminUrl(JUMIA_MOBILE_RETURN_PATH, query);
}
