const HTTP_METHOD_ORDER = [
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT',
] as const;

type HttpMethod = (typeof HTTP_METHOD_ORDER)[number];

function isHttpMethod(value: string): value is HttpMethod {
  return HTTP_METHOD_ORDER.some((method) => method === value);
}

/** Extracts the public HTTP exports of a Next route handler source file. */
export function extractStorefrontRouteMethods(
  source: string,
  options: Readonly<{ includeAutomaticOptions?: boolean }> = {}
) {
  const exported = new Set<HttpMethod>();
  for (const method of HTTP_METHOD_ORDER) {
    const declaration = new RegExp(
      `export\\s+(?:(?:async\\s+)?function|const)\\s+${method}\\b`
    );
    if (declaration.test(source)) exported.add(method);
  }
  for (const block of source.matchAll(/export\s*{([^}]+)}/g)) {
    for (const rawSpecifier of (block[1] ?? '').split(',')) {
      const specifier = rawSpecifier.trim();
      const alias = specifier.match(/\bas\s+([A-Z]+)$/)?.[1];
      const exportedName = alias ?? specifier.match(/^([A-Z]+)\b/)?.[1];
      if (exportedName && isHttpMethod(exportedName))
        exported.add(exportedName);
    }
  }
  if (exported.has('GET')) exported.add('HEAD');
  if (options.includeAutomaticOptions && exported.size > 0)
    exported.add('OPTIONS');
  return HTTP_METHOD_ORDER.filter((method) => exported.has(method));
}
