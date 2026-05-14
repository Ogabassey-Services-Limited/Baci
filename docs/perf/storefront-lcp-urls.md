# Storefront LCP measurement — canonical URL list

The set of production URLs to measure with the PSI tool ([apps/web/tools/seo/run-pagespeed.cli.ts](../../apps/web/tools/seo/run-pagespeed.cli.ts)) when capturing storefront LCP baselines and regression checks.

These are passed via the `PAGESPEED_EXTRA_URLS` environment variable when invoking the CLI. The default route set (`DEFAULT_PAGE_SPEED_ROUTES` in [run-pagespeed.config.ts](../../apps/web/tools/seo/run-pagespeed.config.ts)) covers the marketing site and should stay untouched.

## URLs

| Label | URL | Why |
|---|---|---|
| `storefront-home-ogabassey` | `https://ogabassey.com/` | OgaBassey template homepage on a custom domain — the focus of recent LCP work (PRs #1551, #1548, #1481, #1571, #1575, #1590, #1607). Hero carousel is the LCP element. Primary baseline target. |
| `storefront-pdp-ogabassey` | `https://ogabassey.com/laptops/lenovo-legion-pro-9-16irx9-rtx-4090` | OgaBassey PDP — different LCP element than the home page (product image vs hero). Picked a mid-tier featured laptop from the live store; represents typical product card → detail flow. **Use the `/laptops/...` (category-slug) URL, not `/lenovo/...` (brand-slug).** The brand-slug URL 308-redirects to the canonical category-slug URL, and the redirect handler exits before `TemplateProductPage` is reached, so the route's resource hints (including the Flash Sale banner preload from PR #1634) are NOT emitted on the redirect-source response. PSI follows the redirect so the metric numbers are equivalent, but pointing at the canonical URL avoids the redirect overhead in measurement and prevents future confusion when curling the URL directly to inspect the response. |

## Deferred for v1 baseline

- **Generated merchant subdomain (`*.baci.shop`)** — not measured in v1. Starting with the custom-domain OgaBassey path; if the diagnosis flags TTFB or RSC-graph issues, we'll add a `*.baci.shop` URL to confirm whether the bottleneck is shared or domain-specific.
- **Cart / checkout pages** — LCP element on these (form inputs / order summary) is fundamentally different from hero pages. Out of v1 scope; not currently a known concern.

## Invocation

```bash
export PAGESPEED_INSIGHTS_API_KEY="..."
export PAGESPEED_EXTRA_URLS="https://ogabassey.com/,https://ogabassey.com/products/<slug>,https://<subdomain>.baci.shop/"
export PAGESPEED_STRATEGIES="mobile,desktop"
cd apps/web && pnpm exec tsx tools/seo/run-pagespeed.cli.ts
```

The default thresholds (LCP ≤ 2500ms, CLS ≤ 0.1, TBT ≤ 200ms, INP ≤ 200ms) from `AUDIT_THRESHOLDS` apply. The script exits non-zero if any audit fails.

## Sequencing

Don't capture the baseline before **PR #1607** ("Improve OgaBassey shell LCP streaming") merges to `main` — it changes the OgaBassey shell streaming behavior and a pre-merge baseline would be immediately stale. Check status with `gh pr view 1607 --json state,mergedAt`.

## Reference

See [/Users/mac/.claude/plans/plan-ready-at-docs-superpowers-plans-202-async-cascade.md](../../.claude/plans/plan-ready-at-docs-superpowers-plans-202-async-cascade.md) — the planning doc that scoped this measurement work.
