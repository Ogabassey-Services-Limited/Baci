export function getBoundedEnvInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const boundedFallback = Math.min(Math.max(fallback, minimum), maximum);
  const normalized = value?.trim() ?? '';
  if (!/^[+-]?\d+$/.test(normalized)) return boundedFallback;
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) return boundedFallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}
