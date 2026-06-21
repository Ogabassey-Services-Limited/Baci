export function parseBlogListingPage(page?: string): number {
  const parsedPage = Number.parseInt(String(page ?? '1'), 10);
  return Number.isNaN(parsedPage) ? 1 : Math.max(1, parsedPage);
}
