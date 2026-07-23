import { lookup } from 'node:dns/promises';
import { isIP, isIPv4, isIPv6 } from 'node:net';

// SSRF guard for server-side fetches of caller-supplied URLs.
//
// Needed because the vision provider chain made us fetch image URLs from OUR
// server: Cerebras only accepts base64 data URIs, so a URL that used to be
// handed to Gemini (and fetched by Google's infrastructure) is now downloaded
// by us. `guideBusinessOnboarding` is a 'use server' action reachable before
// signup and takes a `logoUrl` validated only as a well-formed URL, so without
// this guard an anonymous caller could aim our server at loopback, RFC1918, or
// the cloud link-local metadata endpoint (169.254.169.254).
//
// Residual risk, accepted: a DNS-rebinding attacker could return a public
// address to this check and a private one to the subsequent fetch. Closing that
// fully means pinning the resolved IP and setting the Host header ourselves.
// It is not worth that here — the fetch only accepts `image/*` bodies and the
// only thing that flows back to the caller is a handful of extracted brand
// colors, so it is a blind, near-zero-bandwidth channel.

function isPrivateIpv4(ip: string): boolean {
  const octets = ip.split('.').map(Number);
  const [a, b] = octets;
  return (
    a === 0 || // "this" network
    a === 10 || // RFC1918
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local — cloud metadata lives here
    (a === 172 && b >= 16 && b <= 31) || // RFC1918
    (a === 192 && b === 168) || // RFC1918
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    a >= 224 // multicast + reserved
  );
}

function isPrivateIpv6(ip: string): boolean {
  const address = ip.toLowerCase().replace(/^\[|\]$/g, '');

  if (address === '::1' || address === '::') {
    return true;
  }
  // Link-local (fe80::/10) and unique-local (fc00::/7).
  if (/^fe[89ab]/.test(address) || /^f[cd]/.test(address)) {
    return true;
  }
  // IPv4-mapped forms tunnel the v4 ranges through v6 and must be unwrapped and
  // re-checked. Note new URL() normalizes `::ffff:127.0.0.1` to its hex form
  // `::ffff:7f00:1`, so both the dotted-quad and the hex-hextet encodings have
  // to be handled.
  const dotted = address.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    return isPrivateIpv4(dotted[1]);
  }
  const hexMapped = address.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped) {
    const high = Number.parseInt(hexMapped[1], 16);
    const low = Number.parseInt(hexMapped[2], 16);
    const ipv4 = [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
    return isPrivateIpv4(ipv4);
  }
  return false;
}

function isPrivateAddress(ip: string): boolean {
  if (isIPv4(ip)) {
    return isPrivateIpv4(ip);
  }
  if (isIPv6(ip)) {
    return isPrivateIpv6(ip);
  }
  // Unparseable — fail closed.
  return true;
}

/**
 * True when `url` is an http(s) URL that resolves to a publicly-routable
 * address, i.e. safe to fetch server-side with a caller-supplied value.
 *
 * Outside production, loopback and private addresses are allowed so local
 * development against a local Supabase/storage stack keeps working.
 */
export async function isPublicHttpUrl(url: URL): Promise<boolean> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }

  const allowPrivate = process.env.NODE_ENV !== 'production';
  if (allowPrivate) {
    return true;
  }

  // Production: plaintext http to a public host is still an egress we do not
  // want from a user-supplied value.
  if (url.protocol !== 'https:') {
    return false;
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');

  if (isIP(hostname)) {
    return !isPrivateAddress(hostname);
  }

  try {
    const resolved = await lookup(hostname, { all: true });
    if (resolved.length === 0) {
      return false;
    }
    // EVERY answer must be public — a host that resolves to both a public and
    // a private address must not get through on the strength of the public one.
    return resolved.every((entry) => !isPrivateAddress(entry.address));
  } catch {
    return false;
  }
}
