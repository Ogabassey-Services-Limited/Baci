export function getFirstRouteParamValue(
  value: string | string[] | null | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value.find((entry): entry is string => typeof entry === 'string');
  }

  return typeof value === 'string' ? value : undefined;
}
