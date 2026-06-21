// Cap the page far above any realistic blog size so malformed/huge `?page=`
// values (e.g. `999999999999999999999`) can't create unbounded cache keys or
// absurd Supabase range offsets before the listing fetch.
const MAX_BLOG_LISTING_PAGE = 10_000;

export function parseBlogListingPage(page?: string): number {
  const parsedPage = Number.parseInt(String(page ?? '1'), 10);
  if (Number.isNaN(parsedPage)) {
    return 1;
  }
  return Math.min(MAX_BLOG_LISTING_PAGE, Math.max(1, parsedPage));
}
