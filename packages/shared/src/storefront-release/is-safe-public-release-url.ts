import { builderDesignCapabilityAdapter } from '../contracts/builder-design-capability-adapter';

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  )
    return false;
  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second !== undefined && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first !== undefined && first >= 224)
  );
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized.endsWith('.lan') ||
    normalized === '::1' ||
    (normalized.includes(':') &&
      (normalized.startsWith('fe80:') ||
        normalized.startsWith('fc') ||
        normalized.startsWith('fd'))) ||
    (normalized.startsWith('::ffff:') &&
      isPrivateIpv4(normalized.slice('::ffff:'.length))) ||
    isPrivateIpv4(normalized)
  );
}

/** Accepts only query-free navigation URLs that cannot target private networks. */
export function isSafePublicReleaseUrl(value: string): boolean {
  if (!builderDesignCapabilityAdapter.isSafeUrl(value) || value.includes('?'))
    return false;
  if (value.startsWith('/') || value.startsWith('#')) return true;
  try {
    return !isPrivateHostname(new URL(value).hostname);
  } catch {
    return false;
  }
}
