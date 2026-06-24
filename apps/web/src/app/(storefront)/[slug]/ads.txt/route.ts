const ADS_TXT_BODY =
  '# No authorized digital sellers are configured for this storefront.\n';

export function GET() {
  return new Response(ADS_TXT_BODY, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
