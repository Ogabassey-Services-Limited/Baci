const UNSUPPORTED_SPEC_VALUES = new Set([
  '',
  'false',
  'n/a',
  'na',
  'none',
  'not applicable',
  'not available',
  'not supported',
  'no',
  'unsupported',
  'unavailable',
]);

export function isUnsupportedSpecValue(value: unknown) {
  if (typeof value === 'boolean') {
    return !value;
  }

  if (typeof value === 'number') {
    return !Number.isFinite(value) || value === 0;
  }

  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return (
    UNSUPPORTED_SPEC_VALUES.has(normalized) ||
    /^0(?:\.0+)?(?:\s*[a-z]+)?$/.test(normalized) ||
    normalized.startsWith('confirm exact') ||
    normalized.startsWith('not listed') ||
    normalized.startsWith('not published')
  );
}
