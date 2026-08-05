/** Serializes one generated public path segment without double encoding it. */
export function serializeStorefrontProductPathSegment(value: string): string {
  let decodedValue: string;

  try {
    decodedValue = decodeURIComponent(value);
  } catch {
    decodedValue = value;
  }

  return encodeURIComponent(decodedValue.trim());
}
