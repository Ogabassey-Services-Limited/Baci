# SEO Monitoring

This directory contains the repo-side SEO monitoring entrypoints for the web app.

## Commands

- `pnpm --dir apps/web seo:readiness`
  - Fetches live `robots.txt`, sitemap XML, and homepage canonicals
  - Verifies the platform root sitemap keeps public pages crawlable and keeps auth/setup routes out
  - Verifies merchant crawl surfaces if merchant origins are configured

- `pnpm --dir apps/web seo:pagespeed`
  - Calls the PageSpeed Insights API for a small set of critical public URLs
  - Evaluates a stable threshold set for performance, accessibility, best-practices, SEO, LCP, CLS, TBT, and INP

## GitHub workflow inputs

The scheduled workflow in `.github/workflows/seo-monitoring.yml` reads:

- Repository variable `SEO_PLATFORM_ORIGIN`
  - Defaults to `https://usebaci.com`
- Repository variable `SEO_MERCHANT_ORIGINS`
  - Optional comma-separated merchant origins for crawl-surface checks
- Repository variable `PAGESPEED_EXTRA_URLS`
  - Optional comma-separated additional URLs for PageSpeed audits
- Repository variable `PAGESPEED_STRATEGIES`
  - Optional, defaults to `mobile,desktop`
- Repository variable `PAGE_SPEED_TIMEOUT_MS`
  - Optional positive integer override for the per-request PSI timeout in milliseconds
- Repository secret `PAGESPEED_INSIGHTS_API_KEY`
  - Optional but recommended for stable quota

## Scope

This monitoring is intentionally production-origin and schedule-oriented.

- Unlighthouse remains the broad lab audit on `main`
- These scripts add:
  - critical-route PageSpeed checks
  - live crawl-surface readiness checks

They do not replace field data, Search Console UI, or CrUX/RUM reporting.
