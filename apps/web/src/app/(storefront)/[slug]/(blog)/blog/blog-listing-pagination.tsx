import Link from 'next/link';
import { asRoute } from '@/lib/routes';

interface BlogListingPaginationProps {
  basePath: string;
  currentPage: number;
  totalPages: number;
  category?: string;
  search?: string;
}

/**
 * Server-rendered, crawlable pagination for the blog listing. The listing's
 * "load more" is client-side infinite scroll, which crawlers (and Googlebot,
 * which does not reliably scroll) never trigger — so without these `<a>` links
 * only the first page of posts is reachable on-page. These links give crawlers
 * a path to every page and distribute internal-link equity to deeper posts,
 * while preserving the active category/search filter. Page 1 stays param-free
 * to match the canonical `/blog` URL.
 */
function buildPageHref(
  basePath: string,
  page: number,
  category?: string,
  search?: string
): string {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (search) params.set('search', search);
  if (page > 1) params.set('page', String(page));
  const queryString = params.toString();
  return `${basePath}/blog${queryString ? `?${queryString}` : ''}`;
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
  basePath,
  currentPage,
  totalPages,
  category,
  search,
}: BlogListingPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const items = getPageWindow(currentPage, totalPages);

  return (
    <nav
      aria-label="Blog pagination"
      className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-2 px-4 py-10"
    >
      {currentPage > 1 ? (
        <Link
          href={asRoute(
            buildPageHref(basePath, currentPage - 1, category, search)
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
            href={asRoute(buildPageHref(basePath, item.page, category, search))}
            aria-current={item.page === currentPage ? 'page' : undefined}
            className={item.page === currentPage ? ACTIVE_CLASS : LINK_CLASS}
          >
            {item.page}
          </Link>
        )
      )}

      {currentPage < totalPages ? (
        <Link
          href={asRoute(
            buildPageHref(basePath, currentPage + 1, category, search)
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
