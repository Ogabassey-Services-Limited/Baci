# Ogabassey Commercial SEO Design

Date: 2026-04-17
Branch: `codex/ogabassey-cwv-deferment-recovered`
Worktree: `/private/tmp/baci-ogabassey-cwv-deferment-recovered`

## Goal

Raise Ogabassey's commercial SEO maturity beyond technical metadata/schema correctness and toward a stronger semantic, crawlable, revenue-facing search footprint.

The implementation order is intentionally fixed:

1. Add `SearchAction` to the storefront homepage `WebSite` schema.
2. Build the commercial semantic SEO foundation in four phases:
   - Phase 1: crawlable compare/support pages
   - Phase 2: category hub enrichment
   - Phase 3: PDP semantic enrichment
   - Phase 4: informational/content clusters that reinforce the commercial graph

## Current State

### What is already strong

- Product pages already emit strong structured data through:
  - `generateProductSchema()` in `apps/web/src/lib/seo-utils.ts`
  - PDP routes in:
    - `apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.tsx`
    - `apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.tsx`
- Category pages already emit metadata, collection schema, and breadcrumb schema.
- A Google Merchant feed already exists in:
  - `apps/web/src/app/api/feed/google-merchant/route.ts`
  - `apps/web/src/app/api/feed/google-merchant/feed-builder.ts`

### What is still missing

- The storefront homepage emits `WebSite` schema, but not `SearchAction`, even though `generateWebSiteSchema()` already supports it.
- Compare intent is mostly trapped in client UI, especially the PDP compare tab, instead of living on crawlable URLs.
- Category pages are technically correct, but still too generic to serve as strong commercial hubs.
- PDPs are strong as standalone URLs, but weak as nodes in a deliberate semantic decision graph.
- Blog/support content exists, but it is not yet systematically reinforcing the commercial pages.

## Phase 0: Homepage `SearchAction`

### Objective

Expose the storefront's on-site search to crawlers through `WebSite` + `SearchAction` on the homepage.

### Scope

- Update `apps/web/src/app/(storefront)/[slug]/storefront-page-content.tsx`
- Reuse `generateWebSiteSchema()` in `apps/web/src/lib/seo-utils.ts`
- Pass a request-scoped search URL template, using the public storefront search destination

### Expected Output

- Homepage JSON-LD contains:
  - `@type: WebSite`
  - `potentialAction`
  - `@type: SearchAction`
  - `urlTemplate` pointing to the storefront search route with a query placeholder

### Constraints

- Must use request-scoped/canonical storefront URLs, not guessed relative URLs
- Must not emit invalid templates for merchants without a search route
- Must not regress existing homepage schema graph

### Verification

- Update/add homepage schema tests
- Validate rendered HTML for the homepage route
- Ensure no duplicate or conflicting `WebSite` schema objects are created

## Phase 1: Crawlable Compare and Commercial Support Pages

### Objective

Create indexable commercial pages for comparison intent instead of relying mainly on a PDP-local comparison tab.

### Why this phase comes first

This is the largest semantic gap remaining. Ogabassey currently has comparison behavior, but not enough crawlable comparison assets.

### Page Types

- Product vs product pages
  - Example pattern: `/{category}/compare/{product-a}-vs-{product-b}`
- Brand comparison pages
  - Example pattern: `/{category}/compare/{brand-a}-vs-{brand-b}`
- Price-band decision pages
  - Example pattern: `/{category}/best-under-{price-band}`

### Content Structure

- summary verdict
- key differences
- spec comparison table
- use-case sections
- buyer FAQ
- internal links to source PDPs, category hub, and support guides

### SEO Requirements

- unique canonical URL per comparison page
- `BreadcrumbList`
- `FAQPage` when applicable
- descriptive commercial titles and meta descriptions
- no thin auto-generated stubs

### Verification

- render tests for compare pages
- schema validation for compare pages
- internal-link coverage checks from PDPs and category hubs

## Phase 2: Category Hub Enrichment

### Objective

Turn major categories into stronger commercial landing pages, not just product listings.

### Target Categories First

- smartphones
- laptops
- smart TVs

### Additions

- short buyer-intent intro
- “best for” sections
- brand blocks
- price-band blocks
- internal links to compare pages
- stronger FAQ coverage
- clearer hub-to-subhub link structure

### Key Principle

The category page must become the main commercial entity hub for the topic, not just the page that happens to list products.

## Phase 3: PDP Semantic Enrichment

### Objective

Make PDPs better connected commercial decision pages instead of isolated product endpoints.

### Additions

- explicit alternatives block
- links to nearest compare pages
- links to same-brand and same-price decision pages
- stronger trust/buying context modules
- semantic support sections tied to the product category

### Important Note

This phase should emphasize crawlable outgoing relationships, not just more visible UI.

## Phase 4: Content and Informational Cluster Reinforcement

### Objective

Use informational/support content to reinforce the commercial graph after the commercial pages exist.

### Content Types

- buyer guides
- “best X in Nigeria” pages
- support/troubleshooting pages
- decision support content tied to category and compare hubs

### Linking Rules

- informational pages should point into category hubs, compare pages, and selected PDPs
- commercial pages should link back to the most relevant informational guides where helpful

## Architecture Notes

### URL Strategy

- comparison pages must be stable, readable, and canonical
- avoid parameter-only comparison URLs as the primary crawl target
- prefer merchant-scoped public URLs that fit existing storefront routing

### Data Sources

- reuse normalized product/spec data already present in the storefront
- reuse comparison/spec utilities where possible
- avoid introducing duplicate product-shaping logic

### Rendering Strategy

- server-rendered for crawlable SEO pages by default
- client enhancement only where interactivity is required
- preserve existing performance gains from the storefront optimization branch

## Risks

### Low risk

- Phase 0 `SearchAction`
- metadata/schema additions on existing routes

### Medium risk

- category hub content expansion
- PDP internal-link modules

### Higher risk

- new compare route architecture
- canonicalization and duplicate-content handling for generated comparison pages

## Success Criteria

### Technical

- homepage emits valid `SearchAction`
- compare pages are crawlable and indexable
- category hubs expose richer commercial structure
- PDPs participate in an intentional internal-link graph

### Semantic

- Ogabassey covers more “vs”, “best”, brand, and price-band intent with dedicated URLs
- informational content reinforces commercial entities instead of floating separately

### Operational

- no regression to existing storefront CWV work
- no duplicate or conflicting schema output
- no broken canonical behavior across custom domains and slug storefronts

## Rollout Order

1. Homepage `SearchAction`
2. Compare route architecture
3. Category hub enrichment
4. PDP semantic enrichment
5. Informational/content reinforcement

## Recommendation

Proceed with the phases exactly in that order.

Phase 0 is small, clear, and directly useful. After that, the compare-led commercial rollout has the highest expected SEO leverage because it creates new crawlable commercial surfaces instead of only enriching pages that already exist.
