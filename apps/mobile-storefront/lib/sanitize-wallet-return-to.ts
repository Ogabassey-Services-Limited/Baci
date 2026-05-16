const ENCODED_PATH_SEPARATOR_PATTERN = /%(?:2f|5c)/i;

export function sanitizeWalletReturnTo(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  if (ENCODED_PATH_SEPARATOR_PATTERN.test(value)) {
    return undefined;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return undefined;
  }

  if (ENCODED_PATH_SEPARATOR_PATTERN.test(decoded)) {
    return undefined;
  }

  if (
    !decoded.startsWith('/') ||
    decoded.startsWith('//') ||
    decoded.includes('\\') ||
    decoded.includes('/../') ||
    decoded.includes('/./') ||
    decoded.endsWith('/..') ||
    decoded.endsWith('/.')
  ) {
    return undefined;
  }

  return value;
}
