import { OGABASSEY_AGENT_DISCOVERY_LINK_HEADER } from './agent-discovery-link-header';
import { DEFAULT_MEDIA_CDN_ORIGIN } from './cdn';

// Ops-2 (CWV headroom plan): a `preconnect` resource hint to the cross-origin
// image CDN that serves every LCP hero/product image (see lib/image-loader.ts —
// the custom loader returns final `cdn.ogabassey.com` URLs and bypasses Next's
// same-origin optimizer). Emitting it as an HTTP `Link` RESPONSE header lets
// Cloudflare replay it as a 103 Early Hint DURING origin think-time, so the
// browser opens the TCP+TLS connection to the image host before the document
// finishes rendering — the single biggest lever on a cold, cache-MISS/dynamic
// document TTFB for a Nigeria-heavy (high-RTT) audience.
//
// This is DELIBERATELY only a `preconnect`, never an image `preload`: responsive
// hero preloads cannot carry `imagesrcset` selection in an HTTP Link header and
// previously triggered a wasteful mobile-header image fetch that competed with
// the real LCP (kept out; see next.config.test.ts negative assertions). A prior
// preconnect hint was also removed once — but that one pointed at a STALE
// Cloudinary host (#2469); this one targets the LIVE media CDN.
const MEDIA_CDN_PRECONNECT_LINK = `<${DEFAULT_MEDIA_CDN_ORIGIN}>; rel=preconnect`;

/**
 * Combined HTTP `Link` header value emitted on OgaBassey storefront documents
 * (home, PDP, category/listing, blog, static content). Preconnect is listed
 * FIRST so Cloudflare surfaces the performance-critical hint at the head of the
 * 103 Early Hints response; the agent-discovery links follow (Cloudflare only
 * replays `rel=preload`/`rel=preconnect` as 103, so the discovery links ride
 * along only as ordinary response-header metadata).
 */
export const OGABASSEY_DOCUMENT_LINK_HEADER_VALUE = [
  MEDIA_CDN_PRECONNECT_LINK,
  OGABASSEY_AGENT_DISCOVERY_LINK_HEADER,
].join(', ');
