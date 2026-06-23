// Single source of truth for `/ads.txt` across the platform apex, every
// *.usebaci.com merchant subdomain, and merchant custom domains. Served as a
// root Route Handler (not a static public/ads.txt) so the body can be
// host-aware. `/ads.txt` is excluded from the proxy matcher (see proxy.ts) so
// this handler receives the original Host header on every domain — mirroring
// how robots.txt / sitemap.xml are served.

// Google seller-authorization line (AdSense / AdX / Ad Manager).
const GOOGLE_ADS_TXT_LINE =
  'google.com, pub-9332275663101466, DIRECT, f08c47fec0942fa0\n';

const NO_SELLERS_BODY =
  '# No authorized digital sellers are configured for this storefront.\n';

// Owned hosts outside the usebaci.com tree whose ad inventory is monetized under
// the platform's own AdSense account — currently just the ogabassey.com
// flagship. The usebaci.com apex and every *.usebaci.com merchant subdomain are
// matched directly in isOwnedAdHost (covered by the usebaci.com AdSense site
// approval). Third-party custom domains stay on the stub until each is
// individually approved in AdSense.
const OWNED_AD_HOSTS = new Set(['ogabassey.com', 'www.ogabassey.com']);

function normalizeHost(hostHeader: string | null): string {
  if (!hostHeader) {
    return '';
  }
  try {
    // Parsing via URL strips the port and handles IPv6 literals correctly.
    return new URL(`http://${hostHeader}`).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isOwnedAdHost(hostHeader: string | null): boolean {
  const host = normalizeHost(hostHeader);
  if (!host) {
    return false;
  }
  return (
    host === 'usebaci.com' ||
    host.endsWith('.usebaci.com') ||
    OWNED_AD_HOSTS.has(host)
  );
}

export function GET(request: Request): Response {
  const body = isOwnedAdHost(request.headers.get('host'))
    ? GOOGLE_ADS_TXT_LINE
    : NO_SELLERS_BODY;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
      // Body depends on the request host; keep caches host-scoped so a custom
      // domain never receives a subdomain's ads.txt (or vice versa).
      vary: 'Host',
    },
  });
}
