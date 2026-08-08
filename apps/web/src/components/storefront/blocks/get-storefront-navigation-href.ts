export function getStorefrontNavigationHref(
  path: string,
  basePath?: string
): string {
  if (path.toLowerCase().startsWith('http')) return path;
  return `${basePath ?? ''}${path === '/' ? '' : path}`;
}
