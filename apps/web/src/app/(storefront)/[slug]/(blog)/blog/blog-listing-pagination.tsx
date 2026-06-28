import Link from 'next/link';
import { asRoute } from '@/lib/routes';
import { buildBlogListingRouteHref } from './blog-listing-route';

interface BlogListingPaginationProps {
  storeBasePath: string;
  currentPage: number;
  totalPages: number;
  category?: string;
  search?: string;
}

function getPageWindow(
  current: number,
  total: number
): Array<{ key: string; page: number | null }> {
  const shown = new Set<number>(
    [1, total, current - 1, current, current + 1].filter(
      (page) => page >= 1 && page <= total
    )
  );
  const ordered = [...shown].sort((a, b) => a - b);
  const items: Array<{ key: string; page: number | null }> = [];
  let previous = 0;
  for (const page of ordered) {
    if (page - previous > 1) {
      items.push({ key: `gap-${previous}-${page}`, page: null });
    }
    items.push({ key: `page-${page}`, page });
    previous = page;
  }
  return items;
}

const LINK_CLASS =
  'inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted';
const ACTIVE_CLASS =
  'inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-primary bg-primary px-3 text-sm font-semibold text-primary-foreground';

export function BlogListingPagination({
  storeBasePath,
  currentPage,
  totalPages,
  category,
  search,
}: BlogListingPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const items = getPageWindow(safeCurrentPage, totalPages);

  return (
    <nav
      aria-label="Blog pagination"
      className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-2 px-4 py-10"
    >
      {safeCurrentPage > 1 ? (
        <Link
          href={asRoute(
            buildBlogListingRouteHref({
              storeBasePath,
              page: safeCurrentPage - 1,
              category,
              search,
            })
          )}
          rel="prev"
          className={LINK_CLASS}
        >
          Previous
        </Link>
      ) : null}

      {items.map((item) =>
        item.page === null ? (
          <span
            key={item.key}
            aria-hidden="true"
            className="px-1 text-muted-foreground"
          >
            …
          </span>
        ) : (
          <Link
            key={item.key}
            href={asRoute(
              buildBlogListingRouteHref({
                storeBasePath,
                page: item.page,
                category,
                search,
              })
            )}
            aria-current={item.page === safeCurrentPage ? 'page' : undefined}
            className={
              item.page === safeCurrentPage ? ACTIVE_CLASS : LINK_CLASS
            }
          >
            {item.page}
          </Link>
        )
      )}

      {safeCurrentPage < totalPages ? (
        <Link
          href={asRoute(
            buildBlogListingRouteHref({
              storeBasePath,
              page: safeCurrentPage + 1,
              category,
              search,
            })
          )}
          rel="next"
          className={LINK_CLASS}
        >
          Next
        </Link>
      ) : null}
    </nav>
  );
}
