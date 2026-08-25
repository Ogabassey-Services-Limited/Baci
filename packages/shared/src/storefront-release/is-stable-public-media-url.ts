/** Returns whether a media source is immutable-safe for a public release. */
export function isStablePublicMediaUrl(value: string): boolean {
  if (value.length === 0 || value.length > 2_048) return false;
  try {
    const url = value.startsWith('/')
      ? new URL(value, 'https://storefront.invalid')
      : new URL(value);
    return (
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      url.search === '' &&
      url.hash === ''
    );
  } catch {
    return false;
  }
}
