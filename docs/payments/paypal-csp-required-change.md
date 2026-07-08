# PayPal CSP change — REQUIRED before the PayPal button can load in production

**Status:** LAUNCH GATE — needs explicit human approval (touches a protected file)
**Owner file:** `apps/web/src/proxy.ts` (protected — `NEVER modify without explicit approval`)
**Wave:** BYOK Phase 2 (PayPal lane)

## Why this is needed

The storefront checkout now offers a PayPal option (gated by `isPaypalCheckoutAvailable`).
The customer-facing flow loads PayPal's JS SDK v6 (`https://www.paypal.com/web-sdk/v6/core`
and its sandbox host), opens the approval flow, and talks to PayPal's APIs from the browser.
The storefront runs under a **strict Content-Security-Policy** generated in
`generateCSP()` inside `proxy.ts`. Until PayPal's domains are whitelisted in the storefront
`script-src`, `connect-src`, and `frame-src` directives, **the browser blocks the PayPal SDK
script, its API/XHR calls, and its hosted iframes** — so the PayPal button/redirect UX will not
load or function in production. This is the only production blocker for the PayPal lane's UI; the
server routes (`/api/payments/paypal/*`) are unaffected by CSP.

> This change was **not** applied in this branch on purpose: `proxy.ts` is a protected file
> (auth, CSRF, rate limiting, custom domains all flow through it). It must be reviewed and
> applied by a human, ideally as its own isolated commit, before the PayPal option is enabled
> for real merchants.

## Exact required change

Add `https://*.paypal.com https://*.sandbox.paypal.com` to the **storefront** `script-src`,
`connect-src`, and `frame-src` directives in `generateCSP()` (the `routeType === 'storefront'`
branch). Ported verbatim from the prototype commit
`d109422fd2eb9b5fbcae9de131a4a5ecc2684355`
("fix(security): whitelist paypal script connect and frame domains inside proxy CSP").

```diff
--- a/apps/web/src/proxy.ts
+++ b/apps/web/src/proxy.ts
@@ generateCSP() — routeType === 'storefront' branch
-            'script-src': `'self' 'unsafe-inline'${storefrontUnsafeEval} https://vercel.live https://va.vercel-scripts.com https://*.myhuaweicloud.com https://js.useklump.com https://asset.useklump.com https://checkout.useklump.com https://checkout-v2.useklump.com https://directdebit.useklump.com https://checkout.credpal.com https://checkout.creditdirect.ng https://app.creditdirect.ng https://cdl.test.lendastack.io https://securepubads.g.doubleclick.net https://www.googletagservices.com https://pagead2.googlesyndication.com https://www.google.com https://www.gstatic.com https://googleads.g.doubleclick.net https://td.doubleclick.net https://ad.doubleclick.net https://pubads.g.doubleclick.net https://tpc.googlesyndication.com https://cdn.ampproject.org https://*.adtrafficquality.google https://cm.g.doubleclick.net`,
+            'script-src': `'self' 'unsafe-inline'${storefrontUnsafeEval} https://vercel.live https://va.vercel-scripts.com https://*.myhuaweicloud.com https://js.useklump.com https://asset.useklump.com https://checkout.useklump.com https://checkout-v2.useklump.com https://directdebit.useklump.com https://checkout.credpal.com https://checkout.creditdirect.ng https://app.creditdirect.ng https://cdl.test.lendastack.io https://securepubads.g.doubleclick.net https://www.googletagservices.com https://pagead2.googlesyndication.com https://www.google.com https://www.gstatic.com https://googleads.g.doubleclick.net https://td.doubleclick.net https://ad.doubleclick.net https://pubads.g.doubleclick.net https://tpc.googlesyndication.com https://cdn.ampproject.org https://*.adtrafficquality.google https://cm.g.doubleclick.net https://*.paypal.com https://*.sandbox.paypal.com`,
             'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
             'connect-src':
-              "'self' https://*.supabase.co https://vitals.vercel-insights.com https://checkout.useklump.com https://checkout-v2.useklump.com https://directdebit.useklump.com https://checkout.credpal.com https://api.credpal.com https://checkout.creditdirect.ng https://app.creditdirect.ng https://cdl.test.lendastack.io https://securepubads.g.doubleclick.net https://pagead2.googlesyndication.com https://*.adtrafficquality.google https://www.google.com https://googleads.g.doubleclick.net https://pubads.g.doubleclick.net https://cdn.ampproject.org https://cm.g.doubleclick.net",
+              "'self' https://*.supabase.co https://vitals.vercel-insights.com https://checkout.useklump.com https://checkout-v2.useklump.com https://directdebit.useklump.com https://checkout.credpal.com https://api.credpal.com https://checkout.creditdirect.ng https://app.creditdirect.ng https://cdl.test.lendastack.io https://securepubads.g.doubleclick.net https://pagead2.googlesyndication.com https://*.adtrafficquality.google https://www.google.com https://googleads.g.doubleclick.net https://pubads.g.doubleclick.net https://cdn.ampproject.org https://cm.g.doubleclick.net https://*.paypal.com https://*.sandbox.paypal.com",
             'frame-src':
-              "'self' https://asset.useklump.com https://checkout.useklump.com https://checkout-v2.useklump.com https://directdebit.useklump.com https://checkout.credpal.com https://checkout.creditdirect.ng https://app.creditdirect.ng https://cdl.test.lendastack.io https://googleads.g.doubleclick.net https://*.safeframe.googlesyndication.com https://tpc.googlesyndication.com https://td.doubleclick.net https://www.google.com https://cdn.ampproject.org https://*.adtrafficquality.google https://ep2.adtrafficquality.google https://cm.g.doubleclick.net https://securepubads.g.doubleclick.net",
+              "'self' https://asset.useklump.com https://checkout.useklump.com https://checkout-v2.useklump.com https://directdebit.useklump.com https://checkout.credpal.com https://checkout.creditdirect.ng https://app.creditdirect.ng https://cdl.test.lendastack.io https://googleads.g.doubleclick.net https://*.safeframe.googlesyndication.com https://tpc.googlesyndication.com https://td.doubleclick.net https://www.google.com https://cdn.ampproject.org https://*.adtrafficquality.google https://ep2.adtrafficquality.google https://cm.g.doubleclick.net https://securepubads.g.doubleclick.net https://*.paypal.com https://*.sandbox.paypal.com",
```

## Net effect

Each of the three storefront directives gains exactly:

```
https://*.paypal.com https://*.sandbox.paypal.com
```

- `script-src` — allow loading `https://www.paypal.com/web-sdk/v6/core` (and the sandbox host).
- `connect-src` — allow the SDK's XHR/fetch to PayPal.
- `frame-src` — allow PayPal's hosted approval/card iframes.

No other CSP directive, route type, or unrelated allowlist entry changes. Apply only to the
`storefront` branch (merchant dashboard/builder routes do not render the PayPal checkout).

## Verification after applying

1. Load a storefront checkout for a merchant with PayPal enabled + a PayPal-presentable currency.
2. Confirm no CSP violations for `*.paypal.com` in the browser console (Network + Console).
3. Confirm the PayPal SDK script loads and the approval flow opens.
4. Re-run the proxy CSP tests and a storefront smoke test.
