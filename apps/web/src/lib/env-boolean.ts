const TRUE_ENV_VALUES = new Set(['true', '1', 'yes']);
const FALSE_ENV_VALUES = new Set(['false', '0', 'no']);

export function normalizeEnvBoolean(
  value: string | undefined
): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (TRUE_ENV_VALUES.has(normalized)) return true;
  if (FALSE_ENV_VALUES.has(normalized)) return false;
  return undefined;
}
