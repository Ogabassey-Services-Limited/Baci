/**
 * Formats an address that may be a string, a JSON object, or null
 * into a human-readable string.
 */
export function formatAddress(
  address: string | Record<string, unknown> | null
): string {
  if (!address) return 'No address provided';
  if (typeof address === 'string') return address;

  const addr = address as {
    address_line1?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  const parts = [
    addr.address_line1,
    addr.city,
    addr.state,
    addr.country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : 'Address details unavailable';
}
