import {
  getTranslucentColor,
  sanitizeCssColor,
} from '@/lib/colors/sanitize-css-color';

const PRIMARY_FALLBACK = 'rgba(59, 130, 246, 0.125)';

export function getTransparentPrimaryColor(
  primaryLight: string | undefined,
  primary: string
): string {
  const derivedFallback = sanitizeCssColor(primary, PRIMARY_FALLBACK);

  if (primaryLight?.trim()) {
    return sanitizeCssColor(primaryLight, derivedFallback);
  }

  return getTranslucentColor(primary, derivedFallback, 0.125);
}
