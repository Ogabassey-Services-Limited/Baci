export const STOREFRONT_PRODUCTS_PER_PAGE = 20;

export function parseStorefrontPageParam(
  pageParam: string | string[] | null | undefined
): number | null {
  if (Array.isArray(pageParam)) {
    return null;
  }

  if (!pageParam) {
    return 1;
  }

  if (!/^\d+$/.test(pageParam)) {
    return null;
  }

  const parsedPage = Number.parseInt(pageParam, 10);

  if (!Number.isFinite(parsedPage) || parsedPage < 1) {
    return null;
  }

  return parsedPage;
}

export function buildStorefrontPageHref(
  basePath: string,
  page: number
): string {
  if (page <= 1) {
    return basePath;
  }

  const pageSeparator = basePath.includes('?') ? '&' : '?';
  return `${basePath}${pageSeparator}page=${page}`;
}
