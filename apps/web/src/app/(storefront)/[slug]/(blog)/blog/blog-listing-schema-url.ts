export function buildBlogListingSchemaUrl({
  baseUrl,
  category,
  page,
  search,
}: {
  baseUrl: string;
  category?: string;
  page: number;
  search?: string;
}): string {
  const url = new URL('blog', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  if (category) url.searchParams.set('category', category);
  if (search) url.searchParams.set('search', search);
  if (page > 1) url.searchParams.set('page', String(page));
  return url.toString();
}
