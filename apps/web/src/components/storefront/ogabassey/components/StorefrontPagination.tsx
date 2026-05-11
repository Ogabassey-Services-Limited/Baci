import Link from 'next/link';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { asRoute } from '@/lib/routes';
import { buildStorefrontPageHref } from '@/lib/storefront-pagination';

interface StorefrontPaginationProps {
  basePath: string;
  currentPage: number;
  totalPages: number;
  ariaLabel?: string;
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
}: StorefrontPaginationProps) {
  const { safeTotalPages, safeCurrentPage } = sanitizePaginationParams(
    currentPage,
    totalPages
  );

  if (safeTotalPages <= 1) {
    return null;
  }

  const visiblePages = getVisiblePages(safeCurrentPage, safeTotalPages);

  return (
    <nav
      aria-label={ariaLabel}
      className="mt-10 flex flex-wrap items-center justify-center gap-2"
    >
      {safeCurrentPage > 1 && (
        <Link
          href={asRoute(buildStorefrontPageHref(basePath, safeCurrentPage - 1))}
          prefetch={false}
          className="inline-flex items-center gap-2 rounded-xl border border-(--store-background-text)/10 bg-(--store-background) px-4 py-2 text-sm font-medium text-(--store-background-text) transition-colors hover:border-(--store-primary) hover:text-(--store-primary)"
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
                  className="inline-flex h-10 w-10 items-center justify-center text-(--store-background-text)/40"
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
                    ? 'bg-(--store-primary) text-(--store-primary-text)'
                    : 'border border-(--store-background-text)/10 bg-(--store-background) text-(--store-background-text) hover:border-(--store-primary) hover:text-(--store-primary)'
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
          href={asRoute(buildStorefrontPageHref(basePath, safeCurrentPage + 1))}
          prefetch={false}
          className="inline-flex items-center gap-2 rounded-xl border border-(--store-background-text)/10 bg-(--store-background) px-4 py-2 text-sm font-medium text-(--store-background-text) transition-colors hover:border-(--store-primary) hover:text-(--store-primary)"
        >
          Next
          <ChevronRight size={16} />
        </Link>
      )}
    </nav>
  );
}
