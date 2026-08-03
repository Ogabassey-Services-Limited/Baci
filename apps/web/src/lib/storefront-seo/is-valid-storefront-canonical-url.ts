/** Returns whether a canonical URL is an absolute HTTP(S) URL. */
export function isValidStorefrontCanonicalUrl(
  value: string | null | undefined
): value is string {
  if (!value?.trim()) return false;

  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') && !!url.host
    );
  } catch {
    return false;
  }
}
