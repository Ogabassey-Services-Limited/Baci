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

function getVisiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage]);

  for (let page = currentPage - 1; page <= currentPage + 1; page++) {
    if (page > 1 && page < totalPages) {
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
  if (totalPages <= 1) {
    return null;
  }

  const visiblePages = getVisiblePages(currentPage, totalPages);

  return (
    <nav
      aria-label={ariaLabel}
      className="mt-10 flex flex-wrap items-center justify-center gap-2"
    >
      {currentPage > 1 && (
        <Link
          href={asRoute(buildStorefrontPageHref(basePath, currentPage - 1))}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--store-background-text)]/10 bg-[var(--store-background)] px-4 py-2 text-sm font-medium text-[var(--store-background-text)] transition-colors hover:border-[var(--store-primary)] hover:text-[var(--store-primary)]"
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
                  className="inline-flex h-10 w-10 items-center justify-center text-[var(--store-background-text)]/40"
                >
                  <MoreHorizontal size={16} />
                </span>
              )}

              <Link
                aria-current={page === currentPage ? 'page' : undefined}
                href={asRoute(buildStorefrontPageHref(basePath, page))}
                className={`inline-flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-semibold transition-colors ${
                  page === currentPage
                    ? 'bg-[var(--store-primary)] text-[var(--store-primary-text)]'
                    : 'border border-[var(--store-background-text)]/10 bg-[var(--store-background)] text-[var(--store-background-text)] hover:border-[var(--store-primary)] hover:text-[var(--store-primary)]'
                }`}
              >
                {page}
              </Link>
            </div>
          );
        })}
      </div>

      {currentPage < totalPages && (
        <Link
          href={asRoute(buildStorefrontPageHref(basePath, currentPage + 1))}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--store-background-text)]/10 bg-[var(--store-background)] px-4 py-2 text-sm font-medium text-[var(--store-background-text)] transition-colors hover:border-[var(--store-primary)] hover:text-[var(--store-primary)]"
        >
          Next
          <ChevronRight size={16} />
        </Link>
      )}
    </nav>
  );
}
