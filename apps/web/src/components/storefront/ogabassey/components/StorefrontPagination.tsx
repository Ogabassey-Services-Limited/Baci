import Link from 'next/link';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { asRoute } from '@/lib/routes';
import {
  buildStorefrontPageHref,
  getStorefrontCrawlDiscoveryPages,
  STOREFRONT_CRAWL_DISCOVERY_CATEGORY_PAGE_LIMIT,
  STOREFRONT_CRAWL_DISCOVERY_OVERFLOW_MAX_LINKS,
} from '@/lib/storefront-pagination';

interface StorefrontPaginationProps {
  basePath: string;
  currentPage: number;
  totalPages: number;
  ariaLabel?: string;
  crawlDiscoveryAllPagesThreshold?: number;
  crawlDiscoveryLabel?: string;
  crawlDiscoveryMaxLinks?: number;
  crawlDiscoveryPageLabel?: string;
  crawlDiscoveryRequiredPages?: number[];
}

function sanitizePaginationParams(
  currentPage: number,
  totalPages: number
): { safeTotalPages: number; safeCurrentPage: number } {
  const safeTotalPages =
    Number.isInteger(totalPages) && totalPages > 0 ? totalPages : 0;
  const safeCurrentPage =
    Number.isInteger(currentPage) && currentPage > 0
      ? Math.min(currentPage, safeTotalPages || 1)
      : 1;
  return { safeTotalPages, safeCurrentPage };
}

function getVisiblePages(currentPage: number, totalPages: number) {
  const { safeTotalPages, safeCurrentPage } = sanitizePaginationParams(
    currentPage,
    totalPages
  );

  if (safeTotalPages <= 0) {
    return [];
  }

  if (safeTotalPages <= 7) {
    return Array.from({ length: safeTotalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, safeTotalPages, safeCurrentPage]);

  for (let page = safeCurrentPage - 1; page <= safeCurrentPage + 1; page++) {
    if (page > 1 && page < safeTotalPages) {
      pages.add(page);
    }
  }

  return Array.from(pages).sort((left, right) => left - right);
}

export function StorefrontPagination({
  basePath,
  currentPage,
  totalPages,
  ariaLabel = 'Pagination',
  crawlDiscoveryAllPagesThreshold = STOREFRONT_CRAWL_DISCOVERY_CATEGORY_PAGE_LIMIT,
  crawlDiscoveryLabel,
  crawlDiscoveryMaxLinks = STOREFRONT_CRAWL_DISCOVERY_OVERFLOW_MAX_LINKS,
  crawlDiscoveryPageLabel = 'Page',
  crawlDiscoveryRequiredPages = [],
}: StorefrontPaginationProps) {
  const { safeTotalPages, safeCurrentPage } = sanitizePaginationParams(
    currentPage,
    totalPages
  );

  if (safeTotalPages <= 1) {
    return null;
  }

  const visiblePages = getVisiblePages(safeCurrentPage, safeTotalPages);
  const discoveryPages = crawlDiscoveryLabel
    ? getStorefrontCrawlDiscoveryPages({
        totalPages: safeTotalPages,
        currentPage: safeCurrentPage,
        allPagesThreshold: crawlDiscoveryAllPagesThreshold,
        maxPages: crawlDiscoveryMaxLinks,
        requiredPages: crawlDiscoveryRequiredPages,
      })
    : [];

  return (
    <nav
      aria-label={ariaLabel}
      className="mt-10 flex flex-col items-center justify-center gap-4"
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        {safeCurrentPage > 1 && (
          <Link
            href={asRoute(
              buildStorefrontPageHref(basePath, safeCurrentPage - 1)
            )}
            prefetch={false}
            className="inline-flex items-center gap-2 rounded-xl border border-store-background-text/10 bg-store-background px-4 py-2 text-sm font-medium text-store-background-text transition-colors hover:border-store-primary hover:text-store-primary"
          >
            <ChevronLeft size={16} />
            Previous
          </Link>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          {visiblePages.map((page, index) => {
            const previousPage = visiblePages[index - 1];
            const shouldShowGap =
              typeof previousPage === 'number' && page - previousPage > 1;

            return (
              <div key={page} className="flex items-center gap-2">
                {shouldShowGap && (
                  <span
                    aria-hidden="true"
                    className="inline-flex size-10 items-center justify-center text-store-background-text/40"
                  >
                    <MoreHorizontal size={16} />
                  </span>
                )}

                <Link
                  aria-current={page === safeCurrentPage ? 'page' : undefined}
                  href={asRoute(buildStorefrontPageHref(basePath, page))}
                  prefetch={false}
                  className={`inline-flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-semibold transition-colors ${
                    page === safeCurrentPage
                      ? 'bg-store-primary text-store-primary-text'
                      : 'border border-store-background-text/10 bg-store-background text-store-background-text hover:border-store-primary hover:text-store-primary'
                  }`}
                >
                  {page}
                </Link>
              </div>
            );
          })}
        </div>

        {safeCurrentPage < safeTotalPages && (
          <Link
            href={asRoute(
              buildStorefrontPageHref(basePath, safeCurrentPage + 1)
            )}
            prefetch={false}
            className="inline-flex items-center gap-2 rounded-xl border border-store-background-text/10 bg-store-background px-4 py-2 text-sm font-medium text-store-background-text transition-colors hover:border-store-primary hover:text-store-primary"
          >
            Next
            <ChevronRight size={16} />
          </Link>
        )}
      </div>

      {crawlDiscoveryLabel && discoveryPages.length > 0 && (
        <div className="w-full max-w-4xl border-t border-store-background-text/10 pt-4 text-center">
          <p className="text-xs font-semibold uppercase text-store-background-text/45">
            {crawlDiscoveryLabel}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-2">
            {discoveryPages.map((page) => (
              <Link
                key={`crawl-discovery-${page}`}
                href={asRoute(buildStorefrontPageHref(basePath, page))}
                prefetch={false}
                className="text-xs font-medium text-store-primary underline-offset-4 hover:underline"
              >
                {crawlDiscoveryPageLabel} {page}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
