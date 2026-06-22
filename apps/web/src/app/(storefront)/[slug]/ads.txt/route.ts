// Google seller-authorization line (AdSense/AdX/Ad Manager).
// Keep in sync with apps/web/public/ads.txt (served on the platform apex).
const GOOGLE_ADS_TXT_LINE =
  'google.com, pub-9332275663101466, DIRECT, f08c47fec0942fa0\n';

const NO_SELLERS_BODY =
  '# No authorized digital sellers are configured for this storefront.\n';

// Owned hosts outside the usebaci.com tree whose ad inventory is monetized
// under the platform's own AdSense account — currently just the ogabassey.com
// flagship storefront. The usebaci.com apex and every *.usebaci.com merchant
// subdomain are matched directly in isOwnedAdHost (covered by the usebaci.com
// AdSense site approval). Third-party custom domains are intentionally excluded
// until each is individually approved in AdSense.
const OWNED_AD_HOSTS = new Set(['ogabassey.com', 'www.ogabassey.com']);

function isOwnedAdHost(hostHeader: string | null): boolean {
  if (!hostHeader) {
    return false;
  }
  // Strip any port and normalize casing before matching.
  const host = hostHeader.toLowerCase().split(':')[0];
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
      // Response body depends on the request host; keep caches host-scoped so a
      // custom domain never receives a subdomain's ads.txt (or vice versa).
      vary: 'Host',
    },
  });
}
