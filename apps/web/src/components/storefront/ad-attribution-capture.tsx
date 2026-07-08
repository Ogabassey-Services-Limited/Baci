import { CLICK_ID_PARAMS } from '@/lib/ad-tracking-cookies';

// Serialized { urlParam: cookieName } map — e.g. {"gclid":"baci_gclid",…}. Built
// from CLICK_ID_PARAMS so the inline script mirrors the server cookie contract
// (and picks up any new ad platform added there) without a second source list.
// Values are fixed `baci_*` names, so the JSON can never contain `</script>`.
const CLICK_ID_COOKIE_MAP_JSON = JSON.stringify(CLICK_ID_PARAMS);

/**
 * Tiny early inline attribution-capture script (PR-ATTR).
 *
 * Runs before hydration and before the deferred PostHog idle boot so fast-bounce
 * ad conversions never lose their click ID. It:
 *  1. bails while the document is speculatively prerendering
 *     (`document.prerendering`), re-arming on `prerenderingchange` activation —
 *     mirroring `schedule-idle-boot.ts`, so un-activated prerenders never mint
 *     junk attribution cookies or evict bfcache entries;
 *  2. reads `location.search` for the known click-ID params;
 *  3. dedupes: skips any param whose `baci_*` cookie already exists;
 *  4. `fetch(..., { keepalive: true })` GETs `/api/attr`, whose HTTP response
 *     sets the 90-day cookie. HTTP-set (not `document.cookie`) sidesteps Safari
 *     ITP's 24h cap on script-written cookies on link-decorated landings.
 *
 * The whole body is wrapped in try/catch so a hostile/edge browser can never
 * throw on the storefront critical path. No `<`/`>` characters are used, keeping
 * it safe as raw text inside the `<script>` element.
 */
export const AD_ATTRIBUTION_CAPTURE_SCRIPT = `(function(){try{var M=${CLICK_ID_COOKIE_MAP_JSON};var run=function(){try{if(document.prerendering){return}var p=new URLSearchParams(location.search);var q=[];Object.keys(M).forEach(function(k){var v=p.get(k);if(!v){return}var c=M[k];if(("; "+document.cookie).indexOf("; "+c+"=")!==-1){return}q.push(encodeURIComponent(k)+"="+encodeURIComponent(v))});if(!q.length){return}fetch("/api/attr?"+q.join("&"),{keepalive:true,credentials:"same-origin"}).catch(function(){})}catch(e){}};if(document.prerendering){document.addEventListener("prerenderingchange",run,{once:true})}else{run()}}catch(e){}})();`;

/**
 * Server Component that emits the capture script into the storefront static
 * shell. Scoped to storefront routes (rendered from the storefront layout)
 * because their CSP allows `script-src 'unsafe-inline'`; admin/auth routes use a
 * nonce CSP that would block an un-nonced inline script, and are never ad
 * landings anyway. SSR renders the `<script>` verbatim into first-flush HTML.
 */
export function AdAttributionCapture() {
  // React text child (same pattern as the JsonLd component) — not
  // dangerouslySetInnerHTML. The constant carries no user input and no
  // `</script>`, so React emits it verbatim into the script element.
  return <script>{AD_ATTRIBUTION_CAPTURE_SCRIPT}</script>;
}
