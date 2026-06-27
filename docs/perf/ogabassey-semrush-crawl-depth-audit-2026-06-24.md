# OgaBassey Semrush Crawl Depth Audit - 2026-06-24

## Source Scope

Source inputs:

- Semrush notice supplied by the user: `925 pages need more than 3 clicks to be reached`.
- Nine pasted Semrush table exports attached to the Codex thread.
- Live raw-HTML/status probes against `https://ogabassey.com` on 2026-06-24 before this branch is deployed.
- Current source review on branch `codex/ogabassey-crawl-depth`.

The pasted exports contain 900 unique URL rows: 899 on `ogabassey.com` plus one `installments.ogabassey.com` subdomain row. The Semrush UI reports 925 failed URLs, so 25 rows were not present in the pasted export set and must be revalidated after the next Semrush export.

## URL Classification

| URL class | Count in pasted rows | Crawl-depth decision | Implementation response |
|---|---:|---|---|
| Product detail pages | 558 | Index-worthy canonical catalog inventory when product is published and canonical. | Primary fix is `home -> /products -> /products?page=N -> PDP`; `/products` now exposes all page links at current scale. |
| Blog/content pages | 203 | Usually index-worthy content, but not fixed by catalog pagination. | Keep separate from this catalog PR; blog crawl depth needs blog index/archive linking if still high after catalog recrawl. |
| Paginated listing pages | 137 | Useful discovery pages when canonical and non-empty. | Category pages expose all pages up to 20; `/products` exposes all pages up to 100. |
| Compare pages | 1 | Curated commercial-support page if present in the compare allow-list. | Existing compare/price-band hub logic already controls indexability; no broad pair generation added. |
| Subdomain | 1 | Separate property/path graph from `ogabassey.com`. | `installments.ogabassey.com` should be audited separately from storefront catalog depth. |

Highest-depth examples from the pasted rows:

| URL | Class | Semrush depth | Decision |
|---|---|---:|---|
| `https://ogabassey.com/products?page=33` | Pagination | 33 | Important discovery page; fixed by direct `/products?page=N` links from `/products`. |
| `https://ogabassey.com/products?page=34` | Pagination | 32 | Important discovery page; fixed by direct `/products?page=N` links from `/products`. |
| `https://ogabassey.com/gaming-laptops/hp-omen-max-16t-ah000` | PDP | 28 | Important PDP if published; intended path after this PR is via `/products` page index. |
| `https://ogabassey.com/laptops/lenovo-yoga-pro-9-16imh9` | PDP | 27 | Important PDP if published; intended path after this PR is via `/products` page index. |
| `https://ogabassey.com/gaming-laptops/lenovo-legion-pro-7-16iax7-rtx-4080` | PDP | 27 | Important PDP if published; intended path after this PR is via `/products` page index. |
| `https://ogabassey.com/blog/top-5-smartphone-trends-of-2026` | Blog | 19 | Blog-depth follow-up if still reported after catalog recrawl. |
| `https://installments.ogabassey.com` | Subdomain | 5 | Separate subdomain navigation audit. |

Representative rows visible in the Semrush UI excerpt but not found in the pasted export files must be rechecked after export refresh:

| URL | Semrush depth in UI excerpt | Expected branch response |
|---|---:|---|
| `https://ogabassey.com/smartphones/iphone-x-3gb-256gb` | 6 | If published and on the product index, reachable through `/products?page=N` after deploy. |
| `https://ogabassey.com/smartphones/samsung-galaxy-s25-ultra-12gb-256gb` | 4 | Should improve or remain within target if its index page is linked from `/products`. |
| `https://ogabassey.com/smartphones?page=6` | 6 | Category pagination discovery exposes direct category page links when total pages are within the category threshold. |
| `https://ogabassey.com/products?page=64` | not shown in pasted rows | `/products` exposes every page through page 100, including page 64. |

## Live Baseline Probes

Commands run on 2026-06-24 before this branch is deployed:

```bash
curl -Ls https://ogabassey.com/ | grep -oE 'href=[^ >]+' | head -80
curl -Ls https://ogabassey.com/products | grep -oE 'href=[^ >]+' | grep 'products' | head -80
curl -I -L -s 'https://ogabassey.com/products?page=9999'
curl -I -L -s 'https://ogabassey.com/smartphones?page=9999'
curl -Ls 'https://ogabassey.com/products?page=9999' | grep -Eio '<meta[^>]+robots[^>]+>|<link[^>]+canonical[^>]+>|not found|404'
curl -Ls 'https://ogabassey.com/smartphones?page=9999' | grep -Eio '<meta[^>]+robots[^>]+>|<link[^>]+canonical[^>]+>|not found|404'
```

Findings:

- Homepage raw HTML includes `/products`, `/blog`, and crawlable category-root anchors such as `/smartphones`, `/laptops`, `/tablets`, `/gaming`, `/wearables`, `/audio`, `/monitors`, `/printers`, `/accessories`, and `/desktops`.
- Current production `/products` raw HTML includes sparse pagination links such as `/products?page=2` and `/products?page=64`, but not every intermediate product index page.
- Current production `https://ogabassey.com/products?page=9999` returned HTTP `200` in the HEAD probe and included `robots` content equivalent to `index, follow` plus a self-canonical `https://ogabassey.com/products?page=9999` in the body probe. Current branch source already returns noindex not-found metadata for out-of-range products pages; this requires post-deploy verification.
- Current production `https://ogabassey.com/smartphones?page=9999` returned HTTP `200` in the HEAD probe, but the body probe included `noindex, follow`.

## Implemented in This Branch

- Added `getStorefrontCrawlDiscoveryPages` in `apps/web/src/lib/storefront-pagination.ts`.
- Extended `StorefrontPagination` with an optional crawl discovery block while preserving previous/next and compact pagination controls.
- Wired `/products` to expose all product index pages when `totalPages <= 100`.
- Wired category pages to expose all category page links when `totalPages <= 20`.
- Kept all discovery links as visible, text-only anchors with `prefetch={false}`.
- Did not add filter/sort/search links.
- Did not modify `apps/web/src/proxy.ts`.

## Post-Deploy Verification Required

After this PR is deployed:

```bash
curl -Ls https://ogabassey.com/products | grep -oE 'href=[^ >]+' | grep 'products?page='
curl -Ls https://ogabassey.com/products | grep -o 'products?page=64'
curl -Ls https://ogabassey.com/smartphones | grep -oE 'href=[^ >]+' | grep 'smartphones?page=6'
curl -Ls 'https://ogabassey.com/products?page=9999' | grep -Eio '<meta[^>]+robots[^>]+>|<link[^>]+canonical[^>]+>|not found|404'
```

Then export a fresh Semrush crawl-depth table and confirm every important PDP from the affected set is either:

- reachable within 3 clicks through `home -> products -> product-index page -> PDP`,
- intentionally classified as blog/content/subdomain/non-catalog follow-up,
- or assigned to a separate crawl-waste/hub-linking follow-up with evidence.
