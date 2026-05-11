function normalizeStorefrontPath(pathname: string | null) {
  const path = pathname?.trim() || '/';
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

export function isStorefrontHomePath({
  merchantSlug,
  pathname,
  routeSlug,
}: {
  merchantSlug?: string | null;
  pathname: string | null;
  routeSlug: string;
}) {
  const normalizedPathname = normalizeStorefrontPath(pathname).toLowerCase();

  if (normalizedPathname === '/') {
    return true;
  }

  const homePaths = [routeSlug, merchantSlug]
    .filter((slug): slug is string => Boolean(slug?.trim()))
    .map((slug) => normalizeStorefrontPath(`/${slug}`).toLowerCase());

  return homePaths.includes(normalizedPathname);
}
