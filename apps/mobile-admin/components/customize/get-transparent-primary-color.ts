import {
  getTranslucentColor,
  sanitizeCssColor,
} from '@/lib/colors/sanitize-css-color';

const PRIMARY_FALLBACK = 'rgba(59, 130, 246, 0.125)';

export function getTransparentPrimaryColor(
  primaryLight: string | undefined,
  primary: string
): string {
  if (primaryLight?.trim()) {
    return sanitizeCssColor(primaryLight, PRIMARY_FALLBACK);
  }

  return getTranslucentColor(primary, PRIMARY_FALLBACK, 0.125);
}
