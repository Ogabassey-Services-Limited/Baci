export function joinBasePath(basePath: string | undefined, path: string) {
  const normalizedBasePath = (basePath || '').replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${normalizedBasePath}${normalizedPath}`;
}
