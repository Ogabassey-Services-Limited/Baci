import { builderDesignCapabilityAdapter } from '../contracts/builder-design-capability-adapter';

function isNonPublicIpv4(hostname: string): boolean {
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
    (first === 192 && second === 0 && octets[2] === 0) ||
    (first === 192 && second === 0 && octets[2] === 2) ||
    (first === 192 && second === 88 && octets[2] === 99) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && octets[2] === 100) ||
    (first === 203 && second === 0 && octets[2] === 113) ||
    (first !== undefined && first >= 224)
  );
}

function parseIpv6Words(hostname: string): number[] | null {
  let normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!normalized.includes(':') || normalized.includes('%')) return null;
  const dottedTail = normalized.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/u)?.[1];
  if (dottedTail) {
    const octets = dottedTail.split('.').map(Number);
    if (
      octets.length !== 4 ||
      octets.some(
        (octet) => !Number.isInteger(octet) || octet < 0 || octet > 255
      )
    )
      return null;
    normalized = `${normalized.slice(0, -dottedTail.length)}${(
      (octets[0] ?? 0) * 256 + (octets[1] ?? 0)
    ).toString(
      16
    )}:${((octets[2] ?? 0) * 256 + (octets[3] ?? 0)).toString(16)}`;
  }
  const halves = normalized.split('::');
  if (halves.length > 2) return null;
  const parseHalf = (half: string) =>
    half === ''
      ? []
      : half
          .split(':')
          .map((word) =>
            /^[0-9a-f]{1,4}$/u.test(word)
              ? Number.parseInt(word, 16)
              : Number.NaN
          );
  const left = parseHalf(halves[0] ?? '');
  const right = parseHalf(halves[1] ?? '');
  if (
    [...left, ...right].some(
      (word) => !Number.isInteger(word) || word < 0 || word > 0xffff
    )
  )
    return null;
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  if (halves.length === 2 && missing < 1) return null;
  return [...left, ...new Array<number>(missing).fill(0), ...right];
}

function isNonPublicIpv6(hostname: string): boolean {
  const words = parseIpv6Words(hostname);
  if (!words) return false;
  const [first = 0, second = 0, third = 0] = words;
  const isUnspecified = words.every((word) => word === 0);
  const isLoopback =
    words.slice(0, 7).every((word) => word === 0) && words[7] === 1;
  const isIpv4Mapped =
    words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  if (isIpv4Mapped) {
    const high = words[6] ?? 0;
    const low = words[7] ?? 0;
    return isNonPublicIpv4(
      `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`
    );
  }
  return (
    isUnspecified ||
    isLoopback ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xffc0) === 0xfec0 ||
    (first & 0xff00) === 0xff00 ||
    (first === 0x2001 && second === 0x0db8) ||
    (first === 0x2001 && second === 0x0002 && third === 0)
  );
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.+$/u, '');
  const reservedSpecialUseSuffixes = [
    '.alt',
    '.example',
    '.invalid',
    '.internal',
    '.lan',
    '.local',
    '.localhost',
    '.onion',
    '.test',
  ];
  return (
    (!normalized.includes('.') && !normalized.includes(':')) ||
    normalized === 'home.arpa' ||
    normalized.endsWith('.home.arpa') ||
    normalized === 'localhost' ||
    reservedSpecialUseSuffixes.some((suffix) => normalized.endsWith(suffix)) ||
    isNonPublicIpv6(normalized) ||
    isNonPublicIpv4(normalized)
  );
}

function isSafeRootRelativePath(value: string): boolean {
  if (value.startsWith('//') || value.includes('\\')) return false;
  if (/%(?:2e|2f|5c)/iu.test(value)) return false;
  return value
    .split('/')
    .every((segment) => segment !== '.' && segment !== '..');
}

/** Accepts only query-free navigation URLs that cannot target private networks. */
export function isSafePublicReleaseUrl(value: string): boolean {
  if (!builderDesignCapabilityAdapter.isSafeUrl(value) || value.includes('?'))
    return false;
  if (value.startsWith('/')) return isSafeRootRelativePath(value);
  if (value.startsWith('#')) return true;
  try {
    return !isPrivateHostname(new URL(value).hostname);
  } catch {
    return false;
  }
}
