export function buildBlogListingRouteHref({
  storeBasePath,
  category,
  page,
  search,
}: {
  storeBasePath: string;
  category?: string;
  page: number;
  search?: string;
}): string {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (search) params.set('search', search);
  if (page > 1) params.set('page', String(page));
  const queryString = params.toString();
  return `${storeBasePath}/blog${queryString ? `?${queryString}` : ''}`;
}
