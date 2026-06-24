export const STOREFRONT_PRODUCTS_PER_PAGE = 20;
export const STOREFRONT_CRAWL_DISCOVERY_CATEGORY_PAGE_LIMIT = 20;
export const STOREFRONT_CRAWL_DISCOVERY_PRODUCT_PAGE_LIMIT = 100;
export const STOREFRONT_CRAWL_DISCOVERY_MAX_LINKS = 60;

interface StorefrontCrawlDiscoveryPagesOptions {
  totalPages: number;
  currentPage?: number;
  allPagesThreshold?: number;
  maxPages?: number;
  requiredPages?: number[];
  currentWindow?: number;
  edgePageCount?: number;
  jumpInterval?: number;
}

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

  const [pathAndSearch, hash = ''] = basePath.split('#', 2);
  const [pathname, search = ''] = pathAndSearch.split('?', 2);
  const searchParams = new URLSearchParams(search);
  searchParams.set('page', String(page));
  const normalizedSearch = searchParams.toString();

  return `${pathname}${normalizedSearch ? `?${normalizedSearch}` : ''}${hash ? `#${hash}` : ''}`;
}

function getSafePositiveInteger(value: number, fallback: number): number {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function getSafeNonNegativeInteger(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function addPageWhenValid(
  pages: Set<number>,
  page: number,
  totalPages: number
): boolean {
  if (Number.isInteger(page) && page >= 1 && page <= totalPages) {
    pages.add(page);
    return true;
  }

  return false;
}

function addPriorityPageWhenValid(
  priorityPages: number[],
  page: number,
  totalPages: number
) {
  if (
    Number.isInteger(page) &&
    page >= 1 &&
    page <= totalPages &&
    !priorityPages.includes(page)
  ) {
    priorityPages.push(page);
  }
}

function limitCrawlDiscoveryPages(
  pages: Set<number>,
  priorityPages: number[],
  maxPages: number
): number[] {
  const sortedPages = Array.from(pages).sort((left, right) => left - right);
  const safeMaxPages = getSafePositiveInteger(maxPages, 0);

  if (safeMaxPages <= 0 || sortedPages.length <= safeMaxPages) {
    return sortedPages;
  }

  const limitedPages = new Set<number>();

  for (const page of priorityPages) {
    if (pages.has(page)) {
      limitedPages.add(page);
    }

    if (limitedPages.size >= safeMaxPages) {
      return Array.from(limitedPages).sort((left, right) => left - right);
    }
  }

  for (const page of sortedPages) {
    limitedPages.add(page);

    if (limitedPages.size >= safeMaxPages) {
      break;
    }
  }

  return Array.from(limitedPages).sort((left, right) => left - right);
}

export function getStorefrontCrawlDiscoveryPages({
  totalPages,
  currentPage = 1,
  allPagesThreshold = STOREFRONT_CRAWL_DISCOVERY_CATEGORY_PAGE_LIMIT,
  maxPages = STOREFRONT_CRAWL_DISCOVERY_MAX_LINKS,
  requiredPages = [],
  currentWindow = 1,
  edgePageCount = 10,
  jumpInterval = 10,
}: StorefrontCrawlDiscoveryPagesOptions): number[] {
  const safeTotalPages = getSafePositiveInteger(totalPages, 0);

  if (safeTotalPages <= 1) {
    return [];
  }

  const safeAllPagesThreshold = getSafePositiveInteger(allPagesThreshold, 1);

  if (safeTotalPages <= safeAllPagesThreshold) {
    return Array.from({ length: safeTotalPages }, (_, index) => index + 1);
  }

  const discoveryPages = new Set<number>();
  const priorityPages: number[] = [];
  const safeCurrentPage = Math.min(
    getSafePositiveInteger(currentPage, 1),
    safeTotalPages
  );
  const safeCurrentWindow = Math.min(
    safeTotalPages - 1,
    getSafeNonNegativeInteger(currentWindow, 0)
  );
  const safeEdgePageCount = Math.min(
    safeTotalPages,
    getSafePositiveInteger(edgePageCount, 1)
  );
  const safeJumpInterval = getSafePositiveInteger(jumpInterval, 10);

  for (let page = 1; page <= safeEdgePageCount; page++) {
    discoveryPages.add(page);
    discoveryPages.add(safeTotalPages - page + 1);
  }

  for (const page of requiredPages) {
    addPageWhenValid(discoveryPages, page, safeTotalPages);
    addPriorityPageWhenValid(priorityPages, page, safeTotalPages);
  }

  addPriorityPageWhenValid(priorityPages, safeCurrentPage, safeTotalPages);
  addPriorityPageWhenValid(priorityPages, 1, safeTotalPages);
  addPriorityPageWhenValid(priorityPages, safeTotalPages, safeTotalPages);

  for (
    let page = safeCurrentPage - safeCurrentWindow;
    page <= safeCurrentPage + safeCurrentWindow;
    page++
  ) {
    addPageWhenValid(discoveryPages, page, safeTotalPages);
    addPriorityPageWhenValid(priorityPages, page, safeTotalPages);
  }

  for (let page = 1; page <= safeEdgePageCount; page++) {
    addPriorityPageWhenValid(priorityPages, page, safeTotalPages);
    addPriorityPageWhenValid(
      priorityPages,
      safeTotalPages - page + 1,
      safeTotalPages
    );
  }

  const safeMaxPages = getSafePositiveInteger(maxPages, 0);
  const hasLinkCap = safeMaxPages > 0;

  if (!hasLinkCap || discoveryPages.size < safeMaxPages) {
    for (
      let page = safeJumpInterval;
      page < safeTotalPages;
      page += safeJumpInterval
    ) {
      addPageWhenValid(discoveryPages, page, safeTotalPages);

      if (hasLinkCap && discoveryPages.size >= safeMaxPages) {
        break;
      }
    }
  }

  return limitCrawlDiscoveryPages(discoveryPages, priorityPages, safeMaxPages);
}
