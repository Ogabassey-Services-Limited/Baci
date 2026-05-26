# Blog Google Discover Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILLS: Use `superpowers:using-git-worktrees` before implementation, use `superpowers:test-driven-development` for every runtime behavior change, then use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve storefront blog readiness for Google Discover by fixing feed discovery, enforcing publish-date hygiene, and providing large, representative article image signals.

**Architecture:** Keep the blog routes server-rendered and merchant-scoped. Add a focused blog image metadata layer around the existing Supabase Storage upload route so featured images can be validated and variant URLs can be persisted without breaking inline editor image uploads. Harden all public published-post queries so a `published` post without a valid `published_at` cannot leak into feed, sitemap, listing, or article metadata.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase/Postgres, Supabase Storage, Sharp as a server runtime dependency, Zod, Vitest, Biome, Schema.org JSON-LD.

---

## Source Notes
- Google Discover does not require special tags or structured data for eligibility, but recommends large, high-quality, representative images: at least 1200 px wide, more than 300,000 pixels total, 16:9, and enabled by `max-image-preview:large`. Source: [Google Search Central, Discover content policies and image recommendations](https://developers.google.com/search/docs/appearance/google-discover).
- Google Article structured data supports `Article`, `NewsArticle`, and `BlogPosting`. `BlogPosting` is valid for blog content, so this plan does not force a global `NewsArticle` switch. Source: [Google Search Central, Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article).
- Google's Article JSON-LD example uses an `image` array with `1x1`, `4x3`, and `16x9` image URLs, and the Article image guideline recommends multiple high-resolution images with at least 50,000 pixels each. This plan treats the 1200px-wide landscape image as the Discover gate and generates the extra Article ratios at the largest no-upscale size that satisfies the Article image floor.
- Discover guidance explicitly recommends avoiding generic images (for example, site logos) and text-heavy images in `schema.org`/`og:image` image hints. This plan removes logo/generic fallbacks for published blog posts and keeps editorial image quality as an operational QA concern.
- The current storefront blog post metadata already emits `max-image-preview:large`; this plan preserves that and focuses on representative image source quality and public crawl surfaces.

## Non-goals
- This plan does not guarantee Discover ranking or traffic volume.
- This plan does not change editorial strategy, content quality policy, or topic selection.
- This plan does not change `proxy.ts`.
- This plan does not fetch arbitrary external image URLs server-side. Published featured images must be Baci-managed media to avoid SSRF risk.
- This plan does not edit existing migrations. All database work is append-only.

## Execution Discipline
- Implement in an isolated worktree, not the dirty primary checkout.
- Before implementation, verify the current checkout. If it is already a clean linked worktree on the intended branch, continue there. If it is the dirty primary checkout or a stale linked worktree, create a fresh implementation worktree from `origin/main`.
- Follow red-green-refactor for every runtime code path: write the failing test, run it and confirm the expected failure, implement the smallest change, rerun the same test, then refactor while green.
- Do not write production code for a task before its failing test exists. If implementation starts first, revert those implementation edits and restart the task test-first.
- Documentation-only edits can skip TDD, but route, helper, schema, migration, UI, cache, and metadata behavior changes cannot.
- Keep commits small enough to review. A reasonable split is one commit per task after that task's targeted tests pass.

## Implementation Order
1. Task 2 (DB contract) first, so new metadata fields and publish-date constraints exist before API/UI changes depend on them.
2. Task 3 (upload variants) second, so create/edit forms can produce valid metadata payloads.
3. Task 4 (publish guardrails) third, after metadata production exists.
4. Task 1 (feed discovery/cache) and Task 5 (schema/social/hero rendering) can run in either order once Tasks 2-4 are green.
5. Task 6 (sitemap/listing cleanup) after query hygiene from Task 2 is complete.
6. Task 7 (full verification) last.

## Phase Review Gates
- Every task below is a phase. Do not start the next phase until the current phase's review gate is complete or the blocker is explicitly recorded in this plan.
- At each phase gate, update the task checklist with the RED command/output summary, GREEN command/output summary, and any deferred follow-up.
- Review the phase diff with `git diff --check`, `git diff --stat`, and a focused manual pass over every changed file in that phase.
- Run the phase's targeted tests first, then the listed adjacent package gates for the touched surface. Do not rely on final Task 7 to catch local phase regressions.
- Run CodeRabbit on the current phase diff when available and the diff is within tool limits:

```bash
coderabbit review --prompt-only -t uncommitted
```

  Fix all critical and high findings before moving on. If CodeRabbit is unavailable, rate-limited, or over the file limit, record the exact failure and perform the manual review gate anyway; rerun CodeRabbit before final shipment.
- Confirm the dirty diff only contains the files intended for the current phase plus already-reviewed earlier phases. If unrelated files appear, stop and separate the work before continuing.

## Success Criteria
- All public published-post read surfaces require `status = 'published'` and `published_at IS NOT NULL`.
- With `blog_discover_image_validation_enabled` enabled, publishing a post without Discover-ready featured-image metadata fails with a stable, machine-readable error code.
- During staged rollout, publish routes expose the same readiness checks but only block when `merchant_feature_settings.blog_discover_image_validation_enabled` is true for that merchant.
- Blog feed discovery works for slug and custom-domain storefronts, while feed caching converges to one canonical merchant cache key.
- Blog post JSON-LD emits an absolute URL image array in `1:1`, `4:3`, `16:9` order when available, with no generic storefront fallback images.
- Blog post Open Graph/Twitter metadata and visible hero media prefer persisted `landscape_16x9` variants.
- Cache revalidation after blog mutations invalidates feed, listing, and post caches for both slug and custom-domain identifiers.
- Published blog metadata never uses merchant logo or generic `/opengraph-image` fallbacks when a representative post image is unavailable; it emits no blog image instead.

## Current Gaps (Repo-verified)
1. RSS alternate/feed path breaks on custom domains.
   - `apps/web/src/app/(storefront)/[slug]/(blog)/blog/page.tsx:96` uses the route identifier in the feed URL.
   - `apps/web/src/app/(storefront)/[slug]/(blog)/blog/default-blog-ui.tsx:97` links to `/api/blog/feed/${slug}`.
   - `apps/web/src/app/api/blog/feed/[merchantSlug]/route.ts:81` only resolves by merchant `slug`, not custom domain identifier.
2. Published posts with `published_at = null` are not consistently excluded.
   - Feed query only filters `status = published`, then parses `published_at` into `Date`.
   - Similar status-only filtering exists in listing/article queries, related-post queries, root sitemap generation, legacy blog redirects, product/category guide clusters, BlogSnippet fallbacks, and the blog sitemap.
   - The `match_blog_to_product` RPC also filters `status = published` without requiring `published_at`.
3. Feed cache invalidation is incomplete.
   - The RSS route uses `unstable_cache(..., { tags: ['blog-posts'] })`, but `revalidateBlogPosts()` does not invalidate that tag.
4. Article JSON-LD only emits a single image object.
   - `apps/web/src/lib/seo-utils.ts:1986` only supports `image?: string`.
   - `apps/web/src/lib/seo-utils.ts:2047` emits one `ImageObject`.
5. Upload pipeline validates file type and size, but not Discover source-image quality.
   - `apps/web/src/app/api/merchant/blog/upload/route.ts:105` and `apps/web/src/app/api/merchant/blog/upload/route.ts:114`
   - The endpoint is shared by featured-image upload and inline editor image upload, so Discover-grade validation must be purpose-scoped.
6. Blog hero image quality is currently `75`.
   - `apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/blog-post-page-content.tsx:200`
7. Existing published posts will not have the new image metadata immediately after migration.
   - The migration can add columns and backfill `published_at`, but it cannot generate Sharp variants for already-uploaded files.
   - Publish guardrails must not block unrelated edits to legacy published posts whose featured image is unchanged.
8. Blog post social metadata can still fall back to generic images.
   - `apps/web/src/lib/storefront-social-images.ts:15` falls back to `/opengraph-image` when no candidate image exists.
   - `apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/page.tsx:40` includes `merchant.logo_url` as a blog post social-image candidate.
   - Discover-ready article metadata should use representative post imagery only; generic OG or merchant-logo fallbacks should be omitted for published blog posts.
9. Scheduled publishing can bypass API publish validation.
   - `apps/web/src/app/api/cron/publish-scheduled-posts/route.ts:136` batch-updates scheduled rows to `published`.
   - If that path remains enabled as a manual fallback, it must apply the same featured-image readiness contract before publishing rows.
10. Feed cache entries can fragment across identifier forms.
   - The feed route currently caches by raw route param input, so `/api/blog/feed/<slug>` and `/api/blog/feed/<custom-domain>` can produce duplicate cache entries for the same merchant.
   - The plan should normalize feed caching to a canonical merchant key after identifier resolution.

## Product Decisions
1. Keep `@type: BlogPosting` as default.
   - `BlogPosting` is a Google-supported `Article` subtype.
   - Do not switch all posts to `NewsArticle` unless a later content model classifies true news posts.
2. Do not globally reject small inline editor images.
   - The upload route must accept `purpose=inline` or `purpose=featured`.
   - Only `purpose=featured` enforces Discover-grade constraints and generates variants.
3. Published storefront posts should have a managed, representative featured image.
   - Draft and archived posts can keep missing images.
   - Publishing with no featured image, external image URL, undersized image, or missing image metadata should return a validation error once `blog_discover_image_validation_enabled` is enabled for the merchant.
   - While `blog_discover_image_validation_enabled` is false during staged rollout, create/update/scheduled publish routes should compute and return/log readiness warnings but must not block solely on the image-readiness contract.
4. Persist real image variants.
   - Do not rely on undocumented Supabase image transformation URLs.
   - Always generate and store the required `16:9` WebP variant when the source passes Discover checks.
   - A featured source must be able to cover the required `1200x675` landscape crop without upscaling.
   - Generate `1:1` and `4:3` variants when the source can support those crops without quality-damaging enlargement at 50,000+ pixels. They do not need to be 1200 px wide; the strict 1200 px requirement applies to the representative `16:9` Discover image.
5. Treat image-license metadata as optional follow-up.
   - Track it as a Google Images/licensable enhancement, not a Discover gate.

## File Map
- Create: `supabase/migrations/YYYYMMDDHHMMSS_blog_discover_image_metadata.sql`
- Create: `apps/web/src/lib/blog-featured-image-variants.ts`
- Create: `apps/web/src/lib/blog-featured-image-variants.test.ts`
- Create: `apps/web/src/app/api/blog/feed/[merchantSlug]/route.test.ts`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/web/src/app/api/blog/feed/[merchantSlug]/route.ts`
- Modify: `apps/web/src/app/api/merchant/blog/upload/route.ts`
- Modify: `apps/web/src/app/api/merchant/blog/upload/route.test.ts`
- Modify: `apps/web/src/app/api/merchant/blog/posts/route.ts`
- Modify: `apps/web/src/app/api/merchant/blog/posts/route.test.ts`
- Modify: `apps/web/src/app/api/merchant/blog/posts/[id]/route.ts`
- Modify: `apps/web/src/app/api/merchant/blog/posts/[id]/route.test.ts`
- Modify: `apps/web/src/app/api/cron/publish-scheduled-posts/route.ts`
- Modify: `apps/web/src/app/api/cron/publish-scheduled-posts/route.test.ts`
- Modify: `apps/web/src/app/dashboard/blog/page.tsx`
- Modify: `apps/web/src/app/dashboard/blog/blog-client-page.tsx`
- Modify: `apps/web/src/app/dashboard/blog/blog-client-page.test.tsx`
- Modify: `apps/web/src/app/dashboard/blog/new/page.tsx`
- Create: `apps/web/src/app/dashboard/blog/new/page.test.tsx`
- Modify: `apps/web/src/app/dashboard/blog/[id]/edit/page.tsx`
- Create: `apps/web/src/app/dashboard/blog/[id]/edit/page.test.tsx`
- Modify: `apps/web/src/components/blog/novel-features/image-upload.ts`
- Create: `apps/web/src/components/blog/novel-features/image-upload.test.ts`
- Create: `apps/web/src/scripts/report-blog-discover-image-readiness.ts`
- Create: `apps/web/src/scripts/report-blog-discover-image-readiness.test.ts`
- Modify: `apps/web/src/lib/validations/blog.ts`
- Modify: `apps/web/src/lib/validations/blog.test.ts`
- Modify: `apps/web/src/lib/storefront-blog-post-select.ts`
- Modify: `apps/web/src/lib/storefront-blog-post-select.test.ts`
- Modify: `apps/web/src/lib/cached-data.ts`
- Modify: `apps/web/src/lib/cached-data.blog-post.test.ts`
- Modify: `apps/web/src/lib/cached-data.test.ts`
- Modify: `apps/web/src/lib/live-blog-post.ts`
- Modify: `apps/web/src/lib/live-blog-post.test.ts`
- Modify: `apps/web/src/lib/storefront-content/get-published-cluster-posts.ts`
- Modify: `apps/web/src/lib/storefront-content/get-published-cluster-posts.test.ts`
- Modify: `apps/web/src/lib/cache-revalidation.ts`
- Modify: `apps/web/src/lib/cache-revalidation.test.ts`
- Modify: `apps/web/src/lib/get-merchant-blog-cache-identifiers.ts`
- Modify: `apps/web/src/lib/get-merchant-blog-cache-identifiers.test.ts`
- Modify: `apps/web/src/lib/seo-utils.ts`
- Modify: `apps/web/src/lib/seo-utils.test.ts`
- Modify: `apps/web/src/lib/storefront-social-images.ts`
- Modify: `apps/web/src/lib/storefront-social-images.test.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/page.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/sitemap-data.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/sitemap-data.test.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/actions.ts`
- Create: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/actions.test.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/default-blog-ui.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/default-blog-ui.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/sitemap.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/sitemap.test.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/[...catchAll]/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/[...catchAll]/page.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/page.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/blog-post-page-content.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/blog-post-page-content.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/components/BlogSnippet.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/components/BlogSnippet.test.tsx`
- Modify: `apps/web/src/app/api/blog/posts/route.ts`
- Create: `apps/web/src/app/api/blog/posts/route.test.ts`
- Modify: `apps/web/src/app/blog/[slug]/page.tsx`
- Modify: `apps/web/src/app/blog/[slug]/page.test.tsx`

## Implementation Plan

### Task 0: Isolated Worktree And Baseline

**Files:**
- None.

- [x] Detect whether the implementation session is already in a linked worktree:

```bash
git rev-parse --show-toplevel
git rev-parse --git-dir
git rev-parse --git-common-dir
git rev-parse --show-superproject-working-tree 2>/dev/null || true
git branch --show-current
git status --short
```

Expected for a linked worktree: `git rev-parse --git-dir` differs from `git rev-parse --git-common-dir`, and `git rev-parse --show-superproject-working-tree` is empty.

  - Evidence: work is in `/Users/mac/Baci-app/.worktrees/blog-discover-rereview-20260513` on `codex/blog-discover-rereview-20260513`; git dir is the linked-worktree gitdir under `/Users/mac/Baci-app/.git/worktrees/...` and common dir is `/Users/mac/Baci-app/.git`.

- [x] If not already isolated, create the implementation worktree from fresh `origin/main`:

```bash
git fetch origin main --prune
git worktree add -b codex/blog-google-discover-readiness /Users/mac/Baci-app/.worktrees/blog-google-discover-readiness origin/main
cd /Users/mac/Baci-app/.worktrees/blog-google-discover-readiness
```

Expected: worktree created on `codex/blog-google-discover-readiness` with clean `git status --short`.

  - Not needed in this session because the checkout was already an isolated linked worktree. The branch was later refreshed with `origin/main` commit `c12baa809b` before migration dry-run validation.

- [ ] Run baseline gates before editing:

```bash
pnpm --filter @baci/web lint
pnpm --filter @baci/web typecheck
pnpm --filter @baci/web test
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
```

Expected: baseline passes. If baseline fails before any edits, stop and record the failing command/output before deciding whether to continue.

  - Deferred evidence note: a true pre-edit baseline was not captured because implementation edits already existed when this execution pass resumed. Each completed phase records targeted test gates and package lint/typecheck instead; final Task 7 must run the full gates.

- [x] Use TDD for each task below:
  - Add or update the listed test first.
  - Run the narrow test and confirm it fails for the expected missing behavior.
  - Implement the smallest production change.
  - Rerun the narrow test and confirm it passes.
  - Run the task's adjacent affected tests before moving on.

**Review gate before Task 2:**
- [x] Confirm this session is in the isolated linked worktree and not the dirty primary checkout.
- [ ] Record the baseline lint/typecheck/test results in the implementation notes before any production edits.
  - Deferred evidence note: unavailable for this resumed pass; current phase gates and final full gates are the replacement evidence.
- [x] Confirm `git status --short` contains no implementation files from a previous attempt unless they are intentionally carried into this branch.
  - Evidence: dirty files are the intended blog Discover implementation and plan files in this isolated branch.

### Task 1: Feed Discovery And Invalidation

**Files:**
- Modify: `apps/web/src/app/api/blog/feed/[merchantSlug]/route.ts`
- Create: `apps/web/src/app/api/blog/feed/[merchantSlug]/route.test.ts`
- Modify: `apps/web/src/lib/cache-revalidation.ts`
- Modify: `apps/web/src/lib/cache-revalidation.test.ts`
- Modify: `apps/web/src/lib/get-merchant-blog-cache-identifiers.ts`
- Modify: `apps/web/src/lib/get-merchant-blog-cache-identifiers.test.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/page.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/default-blog-ui.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/default-blog-ui.test.tsx`

- [x] Normalize blog feed URLs to canonical merchant slug.
  - In listing metadata and UI feed links, use `data.merchant.slug`, not the route param identifier.
- [x] Make feed route resolve merchant by slug or custom domain identifier.
  - Replace strict `.eq('slug', merchantSlug)` lookup with identifier resolution that accepts both.
  - Keep existing route shape `/api/blog/feed/[merchantSlug]` for backward compatibility.
- [x] Use the storefront URL for feed self-links.
  - Build feed URLs with `new URL('/api/blog/feed/' + merchant.slug, storeUrl).toString()`, not string concatenation.
  - This keeps the storefront host for custom-domain/subdomain stores while avoiding broken path-mode URLs such as `http://localhost:3000/ogabassey/api/blog/feed/...`.
  - Use the same helper for listing metadata alternates, the visible RSS link, and RSS `feedLinks.rss2`.
- [x] Normalize feed cache keys to canonical merchant identity.
  - Resolve identifier (`slug` or custom domain) first, then cache feed data by canonical merchant key (`merchant.id`) so both identifier forms hit the same cache entry.
  - Keep route behavior backward-compatible for both identifier inputs.
- [x] Exclude invalid published timestamps from feed output.
  - Add `.not('published_at', 'is', null)` to the feed post query.
  - Guard channel `updated` and item `date` with parse safety.
- [x] Invalidate feed cache on blog mutations.
  - The RSS route already uses `['blog-rss-feed']` as the `unstable_cache` key but only tags the cached value with `['blog-posts']`.
  - Add an explicit feed cache tag such as `blog-rss-feed` to the `unstable_cache` options, for example `tags: ['blog-posts', 'blog-rss-feed']`.
  - Treat `blog-rss-feed` as a shared coarse/global tag attached to RSS `unstable_cache` entries alongside `blog-posts`.
  - Do not introduce `blog-rss-feed:${merchantId}` in this pass. Per-merchant tags would be more precise, but they add tag cardinality and require the cache definition to know the merchant tag before the value is cached.
  - Use `revalidateTag('blog-rss-feed', 'merchant')` for broad RSS/global cache coherence after blog mutations.
  - Also invalidate the existing generic blog tag with `revalidateTag('blog-posts', 'merchant')` so the historical RSS tag configuration and all `cacheTag('blog-posts')` readers remain coherent.
  - Use `revalidatePath('/api/blog/feed/' + canonicalMerchantSlug)` for merchant-scoped canonical feed route freshness.
  - Update `revalidateBlogPosts()` to call both `revalidateTag('blog-rss-feed', 'merchant')` and `revalidateTag('blog-posts', 'merchant')`, then add regression coverage for each invalidation primitive.
  - Extend the blog revalidation contract so canonical feed-path invalidation does not rely on identifier ordering:
    - add `canonicalMerchantSlug` to `BlogRevalidationOptions`,
    - populate it from merchant lookup via a new `getMerchantBlogRevalidationContext()` helper that returns both `identifiers` and `canonicalMerchantSlug`,
    - call `revalidatePath('/api/blog/feed/' + canonicalMerchantSlug)` when present.
  - Keep `getMerchantBlogCacheIdentifiers()` backward-compatible (still returns `string[]`) for existing read-only consumers outside blog mutation routes; use `getMerchantBlogRevalidationContext()` only where mutation code needs canonical feed-path invalidation.
  - Add JSDoc to both helpers:
    - `getMerchantBlogCacheIdentifiers()`: returns all merchant identifier forms for broad cache/tag/path compatibility and must not imply canonical ordering.
    - `getMerchantBlogRevalidationContext()`: returns identifier forms plus `canonicalMerchantSlug` for mutation revalidation, and guarantees the feed path can be invalidated without guessing from identifier order.
- [x] Add feed route tests for merchant slug lookup, custom-domain lookup, null `published_at` exclusion, custom-domain feed self-link, canonical cache-key behavior, and path-mode feed URL construction that resolves to `/api/blog/feed/<slug>` rather than `/<slug>/api/blog/feed/<slug>`.
- [x] Add cache-revalidation contract tests proving feed-path invalidation uses the explicit canonical slug field (and not inferred identifier order), while existing identifier-based revalidation behavior remains backward-compatible.
- [x] Add helper contract tests proving `getMerchantBlogCacheIdentifiers()` still returns identifier arrays and `getMerchantBlogRevalidationContext()` returns `{ identifiers, canonicalMerchantSlug }` for blog mutation flows.

**Review gate before the next phase:**
- [x] Run the feed/cache tests listed in this task and record the passing command output.
  - GREEN evidence: `pnpm --filter @baci/web test 'src/app/api/blog/feed/[merchantSlug]/route.test.ts' src/lib/cache-revalidation.test.ts src/lib/get-merchant-blog-cache-identifiers.test.ts src/app/api/merchant/blog/posts/route.test.ts 'src/app/api/merchant/blog/posts/[id]/route.test.ts' src/app/api/cron/publish-scheduled-posts/route.test.ts src/app/api/cache/revalidate/route.test.ts` passed with 7 files and 147 tests.
  - Adjacent gates after the Task 1 slice: `pnpm --filter @baci/web lint` and `pnpm --filter @baci/web typecheck` passed.
- [x] Manually inspect feed URL construction for slug storefronts, custom domains, and local path-mode storefronts.
  - Evidence: feed self-links and alternates use `new URL('/api/blog/feed/' + merchant.slug, storeUrl)`, and route tests cover slug, custom domain, and path-mode URL behavior.
- [x] Verify cache invalidation uses explicit `canonicalMerchantSlug` and does not infer canonical order from identifier arrays.
  - Evidence: `BlogRevalidationOptions` now carries `canonicalMerchantSlug`; mutation routes call `getMerchantBlogRevalidationContext()` and cache-revalidation tests assert no feed-path invalidation for custom-domain identifiers when canonical slug is absent.
- [x] Run CodeRabbit or record the CodeRabbit failure, then fix/document all feed/cache findings before continuing.
  - CodeRabbit run completed on the combined Task 1-3 diff. Still-valid major findings were fixed: Novel upload 401 return type, helper error-path coverage, migration test pathing, RPC `SECURITY INVOKER`, DELETE rate limiting, and cache-tag intent documentation. Focused follow-up tests passed with 6 files and 73 tests.

### Task 2: Database Contract For Published Dates And Image Metadata

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_blog_discover_image_metadata.sql`
- Modify: `apps/web/src/lib/storefront-blog-post-select.ts`
- Modify: `apps/web/src/lib/storefront-blog-post-select.test.ts`
- Modify: `apps/web/src/lib/cached-data.ts`
- Modify: `apps/web/src/lib/cached-data.blog-post.test.ts`
- Modify: `apps/web/src/lib/cached-data.test.ts`
- Modify: `apps/web/src/lib/live-blog-post.ts`
- Modify: `apps/web/src/lib/live-blog-post.test.ts`
- Modify: `apps/web/src/lib/storefront-content/get-published-cluster-posts.ts`
- Modify: `apps/web/src/lib/storefront-content/get-published-cluster-posts.test.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/sitemap-data.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/sitemap-data.test.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/actions.ts`
- Create: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/actions.test.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/[...catchAll]/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/[...catchAll]/page.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/components/BlogSnippet.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/components/BlogSnippet.test.tsx`
- Modify: `apps/web/src/app/api/blog/posts/route.ts`
- Create: `apps/web/src/app/api/blog/posts/route.test.ts`
- Modify: `apps/web/src/app/blog/[slug]/page.tsx`
- Modify: `apps/web/src/app/blog/[slug]/page.test.tsx`
- Modify: `apps/web/src/app/api/blog/feed/[merchantSlug]/route.ts`
- Modify: `apps/web/src/app/api/merchant/blog/posts/route.ts`
- Modify: `apps/web/src/app/api/merchant/blog/posts/[id]/route.ts`

- [x] Generate the migration from the worktree root.
  - Run `supabase migration new blog_discover_image_metadata` from the implementation worktree root and use the generated root `supabase/migrations/<timestamp>_blog_discover_image_metadata.sql` file.
  - Verify project refs before any linked migration command:

```bash
ROOT_PROJECT_REF="$(cat supabase/.temp/project-ref 2>/dev/null || true)"
APP_PROJECT_REF="$(cat apps/web/supabase/.temp/project-ref 2>/dev/null || true)"
test -n "$ROOT_PROJECT_REF"
test "$ROOT_PROJECT_REF" = "$APP_PROJECT_REF"
```

  - Expected: both project refs are present and equal. If either `.temp/project-ref` file is missing in the fresh worktree, link the intended Supabase project in both roots or pass the intended `--project-ref` explicitly before applying anything.
  - Do not create or edit `apps/web/supabase/migrations/*`; that directory contains older app-local Supabase assets, while current database migrations belong under root `supabase/migrations/`.
  - Do not edit the old `apps/web/supabase/migrations/20251223150000_create_match_blog_to_product.sql` file. The new root append-only migration should replace the live function with `CREATE OR REPLACE FUNCTION`.
- [x] Add append-only migration columns and published-date constraint:

```sql
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS featured_image_width integer,
  ADD COLUMN IF NOT EXISTS featured_image_height integer,
  ADD COLUMN IF NOT EXISTS featured_image_variants jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.merchant_feature_settings
  ADD COLUMN IF NOT EXISTS blog_discover_image_validation_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.merchant_feature_settings.blog_discover_image_validation_enabled
  IS 'When enabled, blog publish routes block posts without Discover-ready featured image metadata.';

UPDATE public.blog_posts
SET published_at = COALESCE(published_at, updated_at, created_at, now())
WHERE status = 'published'
  AND published_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.blog_posts'::regclass
      AND conname = 'blog_posts_published_at_required'
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_published_at_required
      CHECK (status <> 'published' OR published_at IS NOT NULL)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.blog_posts'::regclass
      AND conname = 'blog_posts_featured_image_width_positive'
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_featured_image_width_positive
      CHECK (featured_image_width IS NULL OR featured_image_width > 0)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.blog_posts'::regclass
      AND conname = 'blog_posts_featured_image_height_positive'
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_featured_image_height_positive
      CHECK (featured_image_height IS NULL OR featured_image_height > 0)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.blog_posts'::regclass
      AND conname = 'blog_posts_featured_image_variants_object'
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_featured_image_variants_object
      CHECK (jsonb_typeof(featured_image_variants) = 'object')
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.blog_posts
  VALIDATE CONSTRAINT blog_posts_published_at_required;

ALTER TABLE public.blog_posts
  VALIDATE CONSTRAINT blog_posts_featured_image_width_positive;

ALTER TABLE public.blog_posts
  VALIDATE CONSTRAINT blog_posts_featured_image_height_positive;

ALTER TABLE public.blog_posts
  VALIDATE CONSTRAINT blog_posts_featured_image_variants_object;

CREATE OR REPLACE FUNCTION public.match_blog_to_product(
  product_embedding extensions.vector,
  merchant_id_filter uuid,
  match_threshold double precision DEFAULT 0.5,
  match_count integer DEFAULT 3
) RETURNS TABLE(
  id uuid,
  title text,
  slug text,
  excerpt text,
  featured_image_url text,
  category text,
  reading_time_minutes integer,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT
    bp.id,
    bp.title,
    bp.slug,
    bp.excerpt,
    bp.featured_image_url,
    bp.category,
    bp.reading_time_minutes,
    1 - (bp.content_embedding <=> product_embedding) as similarity
  FROM blog_posts bp
  WHERE bp.merchant_id = merchant_id_filter
    AND bp.status = 'published'
    AND bp.published_at IS NOT NULL
    AND bp.content_embedding IS NOT NULL
    AND 1 - (bp.content_embedding <=> product_embedding) > match_threshold
  ORDER BY bp.content_embedding <=> product_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_blog_to_product(
  extensions.vector,
  uuid,
  double precision,
  integer
) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.match_blog_to_product(
  extensions.vector,
  uuid,
  double precision,
  integer
) IS 'Finds blog posts semantically similar to a product using pgvector embeddings. Used by BlogSnippet component on product pages.';
```

- [x] Add new columns to blog post selects that need rendering or mutation context.
  - Include `featured_image_width`, `featured_image_height`, and `featured_image_variants`.
- [x] Add the merchant-scoped publish-blocking feature flag.
  - Add `blog_discover_image_validation_enabled?: boolean` to `MerchantFeatureSettings` in `apps/web/src/lib/cached-data.ts` so server route reads are typed.
  - Keep the flag ops-controlled. Do not add it to `merchantFeatureSettingsSchema`, `MERCHANT_FEATURE_SELECT_FIELDS`, `/api/merchant/features` PATCH/PUT handling, or merchant-editable settings UI in this phase.
  - Default must be `false` so the deploy can surface dashboard warnings and readiness reports before blocking publishes.
- [x] Validate migration state against linked project before apply.
  - Run `supabase migration list --linked` from the worktree root.
  - Run `supabase db push --linked --dry-run` and verify only the new migration is pending.
  - Apply with `supabase db push --linked --yes` only after dry-run output matches expectation.
  - Evidence: root and app project refs both read `aivqthbxdshhltbwipbr`. After refreshing this worktree with `origin/main` commit `c12baa809b`, `supabase migration list --linked` showed remote/local parity through `20260513120000` plus only local pending `20260513173234`. `supabase db push --linked --dry-run` reported only `20260513173234_blog_discover_image_metadata.sql` would be pushed.
  - Deployment note: `supabase db push --linked --yes` has not been run from this local implementation pass; keep it as a deployment step after code review/approval.
- [x] Filter public published-post queries with `.not('published_at', 'is', null)`.
  - Cover `getCachedBlogListing`, `getCachedBlogPost`, `getLiveBlogPost`, related-post queries, RSS feed, dedicated blog sitemap, root sitemap blog entries, listing pagination server action, legacy catch-all redirect queries, published cluster posts, BlogSnippet fallback queries, public platform-blog API queries, and the platform blog slug page.
  - Keep `match_blog_to_product` in the migration aligned by requiring `bp.published_at IS NOT NULL`.
- [x] Add select/query tests.
  - Assert `STOREFRONT_BLOG_POST_SELECT` includes the new image metadata fields.
  - Assert the feature flag is present in the DB migration and `MerchantFeatureSettings` type surface.
  - Verify the ops-only flag was not exposed through merchant-editable surfaces:

```bash
rg -n "blog_discover_image_validation_enabled" apps/web/src/app/api/merchant/features apps/web/src/schemas/merchant-features.ts apps/web/src/app/dashboard/settings
```

Expected: no matches.

  - Assert cached, live, sitemap, legacy redirect, listing pagination, published cluster, BlogSnippet fallback, RSS, public API, and platform blog page queries exclude `published_at IS NULL` rows.
- [x] Keep drafts and archived posts unaffected.
  - Evidence: the published-date constraint is `CHECK (status <> 'published' OR published_at IS NOT NULL)`, and public read filters only tighten published surfaces.

**Review gate before the next phase:**
- [x] Run the Task 2 targeted tests and record the RED-to-GREEN evidence for every changed query surface.
  - GREEN evidence: `pnpm --filter @baci/web test src/lib/blog-discover-image-metadata-migration.test.ts src/lib/storefront-blog-post-select.test.ts src/lib/cached-data.blog-post.test.ts src/lib/cached-data.test.ts src/lib/live-blog-post.test.ts src/lib/storefront-content/get-published-cluster-posts.test.ts 'src/app/(storefront)/[slug]/sitemap-data.test.ts' 'src/app/(storefront)/[slug]/(blog)/blog/actions.test.ts' 'src/app/(storefront)/[slug]/(blog)/blog/[...catchAll]/page.test.tsx' src/components/storefront/ogabassey/components/BlogSnippet.test.tsx src/app/api/blog/posts/route.test.ts 'src/app/blog/[slug]/page.test.tsx' 'src/app/api/blog/feed/[merchantSlug]/route.test.ts' src/app/api/merchant/blog/posts/route.test.ts 'src/app/api/merchant/blog/posts/[id]/route.test.ts'` passed with 15 files and 139 tests.
- [x] Confirm the root and app-local Supabase project refs are present and equal before any linked migration dry-run or apply.
  - Evidence: both refs are `aivqthbxdshhltbwipbr`.
- [x] Run `supabase migration list --linked` and `supabase db push --linked --dry-run`; confirm only the new root migration is pending before applying anything.
  - Evidence: after merging `origin/main`, dry-run would push only `20260513173234_blog_discover_image_metadata.sql`.
- [x] Manually inspect the migration for append-only behavior, `NOT VALID` constraint creation, post-backfill validation order, and `match_blog_to_product` requiring `bp.published_at IS NOT NULL`.
  - Evidence: migration is append-only under root `supabase/migrations/`, backfills before validation, validates constraints after `NOT VALID`, and redefines `match_blog_to_product` with `bp.published_at IS NOT NULL` plus `SECURITY INVOKER` so RLS is not bypassed.
- [x] Verify `blog_discover_image_validation_enabled` is not exposed through merchant-editable settings by running the `rg` command above.
  - Evidence: command returned no matches in merchant feature routes, merchant-features schema, or dashboard settings.
- [x] Run CodeRabbit or record the CodeRabbit failure, then fix/document all schema/query findings before continuing.
  - Evidence: CodeRabbit run completed on the combined Task 1-3 diff; schema/security findings were fixed by switching the RPC from `SECURITY DEFINER` to `SECURITY INVOKER` and strengthening migration tests. Focused follow-up tests passed with 6 files and 73 tests.

### Task 3: Featured Image Upload Validation And Variant Generation

**Files:**
- Create: `apps/web/src/lib/blog-managed-storage-paths.ts`
- Create: `apps/web/src/lib/blog-managed-storage-paths.test.ts`
- Create: `apps/web/src/lib/blog-featured-image-variants.ts`
- Create: `apps/web/src/lib/blog-featured-image-variants.test.ts`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/web/src/app/api/merchant/blog/upload/route.ts`
- Modify: `apps/web/src/app/api/merchant/blog/upload/route.test.ts`
- Modify: `apps/web/src/app/dashboard/blog/new/page.tsx`
- Create: `apps/web/src/app/dashboard/blog/new/page.test.tsx`
- Modify: `apps/web/src/app/dashboard/blog/[id]/edit/page.tsx`
- Create: `apps/web/src/app/dashboard/blog/[id]/edit/page.test.tsx`
- Modify: `apps/web/src/components/blog/novel-features/image-upload.ts`
- Create: `apps/web/src/components/blog/novel-features/image-upload.test.ts`

- [x] Make Sharp available to the production upload route.
  - Move `sharp` from `devDependencies` to `dependencies` in `apps/web/package.json`; the helper will be imported by a runtime upload route.
  - Update `pnpm-lock.yaml` with pnpm; do not hand-edit the lockfile.
  - Keep all Sharp imports in server-only code paths.
  - Keep the upload route on the Node.js runtime; add `export const runtime = 'nodejs'` if needed so Sharp is never bundled for Edge.
- [x] Add a focused image helper.
  - Define constants for `MIN_FEATURED_IMAGE_WIDTH = 1200`, `MIN_FEATURED_IMAGE_HEIGHT = 675`, `MIN_EXCLUSIVE_FEATURED_IMAGE_PIXELS = 300_000`, `MAX_FEATURED_IMAGE_BYTES = 5 * 1024 * 1024`, `MAX_FEATURED_IMAGE_PIXELS = 40_000_000`, and `SHARP_PROCESSING_TIMEOUT_SECONDS = 4`.
  - Keep the 300,000-pixel check explicit for Google Discover policy parity even though the required `1200x675` landscape crop already exceeds that floor.
  - The existing 5 MB upload cap is not enough by itself because compressed images can still decode to huge pixel counts, so reject sources above the decoded-pixel cap before resize work.
  - Define variant keys `square_1x1`, `standard_4x3`, and `landscape_16x9`.
  - Use Sharp to read metadata and generate `landscape_16x9` at `1200x675` with `fit: 'cover'` and attention-based cropping.
  - Apply Sharp's processing timeout to metadata and resize pipelines, for example `.timeout({ seconds: SHARP_PROCESSING_TIMEOUT_SECONDS })`, and map timeout failures to a stable retryable error code such as `BLOG_FEATURED_IMAGE_PROCESSING_TIMEOUT`.
  - For `purpose=featured`, allow only static representative source formats (`image/jpeg`, `image/png`, `image/webp`, `image/avif`). Keep GIF support for `purpose=inline` only.
  - Reject featured images that cannot cover `1200x675` without upscaling; a `1200x630` source is too short even though its width is 1200.
  - Generate optional Article variants at the largest no-upscale dimensions that satisfy Google's 50,000-pixel floor:
    - `standard_4x3`: prefer `1200x900` when the source can cover it; otherwise use the largest `4:3` crop from the source, such as `900x675` for a `1200x675` source.
    - `square_1x1`: prefer `1200x1200` when the source can cover it; otherwise use the largest square crop from the source, such as `675x675` for a `1200x675` source.
  - Omit an optional variant only when the largest no-upscale crop would be below 50,000 pixels. Use the same attention-based crop strategy for optional variants.
  - Reject featured images when source width is below `1200`, source height is below `675`, `width * height <= MIN_EXCLUSIVE_FEATURED_IMAGE_PIXELS`, or `width * height > MAX_FEATURED_IMAGE_PIXELS`. This preserves Google's "more than 300,000 pixels" rule: exactly 300,000 pixels is rejected, 300,001 pixels can pass the pixel-floor check.
  - Reject unreadable, unsupported, animated, or metadata-less featured images before any storage upload.
  - Add helpers that validate and recover Baci-managed blog media paths for the current merchant; reuse them for publish validation and upload deletion instead of parsing URLs ad hoc at call sites.
  - Normalize recovered paths before validation by removing query strings/fragments and collapsing duplicate slashes.
  - Recover paths from Supabase public storage URLs containing `/storage/v1/object/public/media/` and from CDN URLs only when the normalized path starts with `${merchant.id}/blog/`. Reject legacy `/blog/YYYY/...`, `core-assets`, and other non-merchant-owned CDN URLs for new published posts.
  - Instrument processing duration and failures with structured logs or the existing app observability path, including merchant id, purpose, source dimensions, generated variant keys, timeout status, and elapsed milliseconds. Do not log raw file contents or signed URLs.
- [x] Add `purpose` parsing to the upload route.
  - Keep the protected route boundary aligned with `AGENTS.md`: authenticate and load merchant access before CSRF/body parsing, then perform CSRF validation before reading upload bytes or mutating storage.
  - Use Zod against `formData.get('purpose')`.
  - Default to `inline` to preserve current editor image behavior.
  - Featured-image upload forms must send `purpose=featured`.
- [x] For `purpose=featured`, validate and upload variants.
  - Read the file buffer and validate dimensions before any Supabase Storage upload.
  - Original path remains `${merchant.id}/blog/${filename}`.
  - Variant paths should be deterministic within the current upload, for example `${merchant.id}/blog/variants/${uniqueBasename}-16x9.webp`, where `uniqueBasename` includes the generated upload filename/id and is not derived only from the original client filename.
  - Avoid collisions when two concurrent requests upload the same original source filename. If the implementation uses a content hash or normalized original filename, add conflict handling so one request cannot overwrite or clean up the other request's variants.
  - Upload generated variants with explicit `contentType: 'image/webp'`.
  - If any original or variant upload fails after one or more paths were written, remove every path written in that request before returning the error.
  - Track only paths successfully uploaded by the current request. Do not clean up paths inferred from the planned response shape if their upload never succeeded.
  - Cleanup must be idempotent and retry-safe. Treat missing path, 404, and "object not found" delete results as successful cleanup; log unexpected storage delete errors but do not mask the original upload failure.
  - If source validation or Sharp processing exceeds the synchronous budget, fail fast with `BLOG_FEATURED_IMAGE_PROCESSING_TIMEOUT` after cleanup. Only return `202` and defer processing if the implementation reuses existing job/worker infrastructure cleanly; do not add a new queue/status system as a hidden dependency for this phase.
  - Response shape should include:

```ts
{
  url: string;
  path: string;
  filename: string;
  size: number;
  type: string;
  width: number;
  height: number;
  variants: {
    square_1x1?: string;
    standard_4x3?: string;
    landscape_16x9: string;
  };
  variantPaths: {
    square_1x1?: string;
    standard_4x3?: string;
    landscape_16x9: string;
  };
}
```

- [x] For `purpose=inline`, keep the current response shape compatible.
  - Inline uploads may include dimensions when cheap to compute, but they must not require Discover-grade width.
- [x] Update upload deletion for generated variants.
  - Keep backward compatibility for `{ path }`.
  - Replace `deleteBodySchema` with an explicit schema:

```ts
const variantPathSchema = z.object({
  square_1x1: z.string().min(1).optional(),
  standard_4x3: z.string().min(1).optional(),
  landscape_16x9: z.string().min(1).optional(),
});

const deleteBodySchema = z.object({
  path: z.string().min(1, 'No path provided'),
  variantPaths: variantPathSchema.optional(),
});
```

  - Delete the deduped set of `[path, ...Object.values(variantPaths ?? {})]` in one request.
  - Validate every path against the current merchant and allow only `${merchant.id}/blog/<filename>` and `${merchant.id}/blog/variants/<filename>` shapes.
  - Add tests proving another merchant's original or variant path is rejected.
- [x] Update dashboard featured-image upload handlers to persist returned dimensions and variants in form state.
  - Extend `PostFormData` in both new and edit pages with `featured_image_width`, `featured_image_height`, and `featured_image_variants`.
  - Hydrate edit state from the fetched post and include the new fields in create/PATCH payloads.
  - Clear width, height, and variants when the featured image URL is removed or replaced.
  - Preview the returned `landscape_16x9` variant in the dashboard featured-image panel after upload so the merchant sees the Discover crop before publishing.
  - Track returned `path` and `variantPaths` in transient component state so Remove Image or replacement can call the DELETE route for newly uploaded files.
  - For persisted posts, recover managed storage paths from the stored URLs before deletion; if a URL is not Baci-managed for the current merchant, only clear metadata and do not call storage deletion.
  - Preserve autosave/recovery compatibility by including the new fields in recovered form state.
- [x] Update inline editor upload handlers and Novel upload integration to send `purpose=inline`.
  - Novel upload integration now sends `purpose=inline` (`apps/web/src/components/blog/novel-features/image-upload.ts` + colocated test).
  - Dashboard new/edit page inline handlers now append `purpose=inline`.
- [x] Add tests for auth-before-CSRF behavior on protected upload/delete requests, undersized featured rejection, featured GIF rejection, `1200x630` short-source rejection, low-total-pixel/dimension rejection, too-large decoded-pixel rejection, unreadable metadata rejection, Sharp timeout handling, no storage upload on validation failure, cleanup after partial variant upload failure, retry after partial upload failure, concurrent upload of the same original featured image filename, required `landscape_16x9` upload, variant upload `contentType: image/webp`, `1200x675` source producing no-upscale `900x675` and `675x675` Article variants, optional `1:1`/`4:3` omission when the largest no-upscale crop is below 50,000 pixels, managed-path URL recovery/rejection, delete schema backward compatibility for `{ path }`, delete schema support for `variantPaths`, delete request path deduplication, inline upload compatibility (including GIF acceptance for `purpose=inline`), dashboard featured upload state updates, dashboard preview of the required landscape variant, and structured processing metrics/log payloads without file contents.
  - Completed across Task 3 tests: auth-before-CSRF upload/delete tests, featured GIF rejection, `1200x630` rejection, decoded-pixel overflow rejection, unreadable metadata rejection, Sharp timeout-path mapping, no storage upload on validation failure, required `landscape_16x9` generation, `900x675` and `675x675` no-upscale variants from `1200x675`, optional-variant omission threshold behavior, managed-path URL recovery/rejection, delete `{ path }` compatibility, delete object `variantPaths` + dedupe, inline GIF compatibility, cleanup on partial variant-upload failure, repeated same-filename upload collision protection via unique storage paths, dashboard featured upload state updates, dashboard `landscape_16x9` preview, dashboard/Novel inline `purpose=inline`, and structured log payload assertions without file contents.

**Review gate before the next phase:**
- [x] Run upload/helper/dashboard targeted tests and record RED-to-GREEN evidence for featured and inline upload paths.
  - RED evidence captured: missing helper module import and upload-route auth/CSRF/purpose contract failures before route rewrite.
  - GREEN evidence captured: `pnpm --filter @baci/web test src/lib/blog-featured-image-variants.test.ts src/app/api/merchant/blog/upload/route.test.ts src/components/blog/novel-features/image-upload.test.ts` passing with 19 tests.
  - Additional GREEN evidence captured after dashboard wiring: `pnpm --filter @baci/web test src/app/dashboard/blog/new/page.test.tsx 'src/app/dashboard/blog/[id]/edit/page.test.tsx' src/app/api/merchant/blog/upload/route.test.ts src/lib/blog-managed-storage-paths.test.ts src/lib/blog-featured-image-variants.test.ts src/components/blog/novel-features/image-upload.test.ts` passing with 36 tests.
  - Adjacent package gates: `pnpm --filter @baci/web lint` and `pnpm --filter @baci/web typecheck` both passing after this slice.
- [x] Manually inspect protected route ordering: authentication and merchant access first, CSRF before byte reads or storage mutation, no service-role client in client code.
- [x] Verify Sharp stays in Node-only server paths and no Edge route imports it.
  - Confirmed by `rg`: `blog-featured-image-variants.ts` is imported by the Node upload route and tests only; dashboard code imports the client-safe `blog-managed-storage-paths.ts` helper instead.
- [x] Review storage cleanup paths for partial upload failure, retry safety, same-merchant path validation, and concurrent filename collision behavior.
  - Coverage includes partial-upload cleanup, same-merchant path validation, object `variantPaths` delete support, and repeated same-original-filename unique paths.
- [x] Run CodeRabbit or record the CodeRabbit failure, then fix/document all upload/storage/security findings before continuing.
  - CodeRabbit run completed (`coderabbit review --prompt-only -t uncommitted`): addressed still-valid Task 3 findings (upload rate limiting, DELETE malformed-JSON handling, duplicate dimension-field cleanup, helper prototype-chain hardening, and additional validation tests). Remaining findings are largely outside this Task 3 slice and will be handled in their owning tasks/files.

### Task 4: Publish-Time Guardrails And Legacy Remediation

**Files:**
- Modify: `apps/web/src/lib/validations/blog.ts`
- Modify: `apps/web/src/lib/validations/blog.test.ts`
- Modify: `apps/web/src/app/api/merchant/blog/posts/route.ts`
- Modify: `apps/web/src/app/api/merchant/blog/posts/route.test.ts`
- Modify: `apps/web/src/app/api/merchant/blog/posts/[id]/route.ts`
- Modify: `apps/web/src/app/api/merchant/blog/posts/[id]/route.test.ts`
- Modify: `apps/web/src/app/api/cron/publish-scheduled-posts/route.ts`
- Modify: `apps/web/src/app/api/cron/publish-scheduled-posts/route.test.ts`
- Modify: `apps/web/src/app/dashboard/blog/page.tsx`
- Modify: `apps/web/src/app/dashboard/blog/blog-client-page.tsx`
- Modify: `apps/web/src/app/dashboard/blog/blog-client-page.test.tsx`
- Create: `apps/web/src/scripts/report-blog-discover-image-readiness.ts`
- Create: `apps/web/src/scripts/report-blog-discover-image-readiness.test.ts`

- [x] Extend blog validation schemas.
  - Add `featured_image_width`, `featured_image_height`, and `featured_image_variants`.
  - Variant keys must be strict known keys only: `square_1x1`, `standard_4x3`, and `landscape_16x9`.
  - Variant values must be valid URLs when provided.
  - Update `sanitizeBlogPostData()` so numeric image dimensions and nested `featured_image_variants` survive create, update, preview, and autosave payloads.
  - Clear image metadata when `featured_image_url` is explicitly nulled or emptied: set `featured_image_width` and `featured_image_height` to `null`, and set `featured_image_variants` to `{}` (never `null`) to satisfy the DB `NOT NULL` constraint.
  - Parse and sanitize request bodies through `sanitizeBlogPostData()` before schema validation in create and update routes.
- [x] Add a publish validation helper.
  - When `status === 'published'`, require `featured_image_url`, Baci-managed media URL owned by the current merchant, width >= `1200`, height >= `675`, width * height > `MIN_EXCLUSIVE_FEATURED_IMAGE_PIXELS`, and `featured_image_variants.landscape_16x9`.
  - Require every provided variant URL to be Baci-managed media owned by the same merchant and to recover to an allowed `${merchant.id}/blog/variants/<filename>` path. Reject external variant URLs and variants from another merchant.
  - Do not fetch arbitrary external URLs.
  - Return a typed result such as `{ ready: true } | { ready: false; code: BlogDiscoverImageReadinessCode; details: Record<string, unknown> }` so route handlers can either warn or block depending on `blog_discover_image_validation_enabled`.
  - Split hard data-integrity failures from rollout-controlled readiness failures: malformed `featured_image_variants`, unknown variant keys, external variant URLs, and cross-merchant variant URLs must always return `400`; the feature flag only controls whether missing/insufficient Discover readiness blocks publishing.
- [x] Read and apply the rollout feature flag.
  - Create/update/scheduled publish handlers must select `blog_enabled` and `blog_discover_image_validation_enabled` from `merchant_feature_settings`.
  - If `blog_discover_image_validation_enabled` is false or missing, allow the publish mutation to proceed but include `discoverImageReadiness: { ready: false, code, details }` warnings in the JSON response for create/update and structured logs for scheduled publishing.
  - If `blog_discover_image_validation_enabled` is true, block invalid publishes with the stable error codes below.
  - Treat a feature-settings read error as fail-closed for blocking mode only if the route can prove the flag is true from a successful read; otherwise keep existing blog-enabled behavior and log that image-validation enforcement could not be evaluated.
- [x] Apply the helper on create.
  - Return `400` with stable error codes and reason details, for example: `BLOG_FEATURED_IMAGE_NOT_DISCOVER_READY`, `BLOG_FEATURED_IMAGE_NOT_MANAGED`, `BLOG_FEATURED_IMAGE_VARIANT_MISSING`.
- [x] Apply the helper on update.
  - If an existing published post is edited and remains published, use existing stored image metadata when fields are omitted from PATCH.
  - If a legacy published post has no image metadata and the featured image URL is unchanged, allow unrelated edits instead of forcing immediate re-upload.
  - If a published post changes its featured image URL, require the full metadata contract in the same request.
  - If a draft transitions to published, require the complete metadata contract.
- [x] Apply the helper on scheduled publishing.
  - Select scheduled rows with `featured_image_url`, `featured_image_width`, `featured_image_height`, and `featured_image_variants` before the batch update.
  - When `blog_discover_image_validation_enabled` is true for the merchant, publish only scheduled rows that satisfy the same Discover-ready featured-image contract.
  - When the flag is false, publish otherwise-valid scheduled rows and log `{ id, reason }` readiness warnings without skipping solely on image readiness.
  - Leave invalid scheduled rows unchanged only when the merchant's validation flag is enabled, and include `{ id, reason }` objects in a `skipped` response field for operational visibility.
  - Compute cache revalidation identifiers, listing pages, categories, and post slugs from the eligible published set only.
  - If no scheduled row is eligible, return success with `published: 0` and do not call the batch update.
- [x] Surface legacy published-post remediation in the dashboard.
  - Extend the dashboard blog list select to include `featured_image_url`, `featured_image_width`, `featured_image_height`, and `featured_image_variants`.
  - Compute a per-post readiness state: `ready`, `legacy_missing_metadata`, `missing_featured_image`, `unmanaged_featured_image`, or `missing_landscape_variant`.
  - Show a compact dashboard banner when any published post is not Discover-ready. The banner should tell the merchant how many published posts need image updates and link/filter to those posts.
  - Show a per-row status indicator for published posts that need image remediation. Drafts and archived posts should not be flagged.
- [x] Add an ops report script for legacy rows.
  - `apps/web/src/scripts/report-blog-discover-image-readiness.ts` should default to dry-run report mode.
  - Report published posts whose featured-image metadata is missing, non-managed, too small, or missing `landscape_16x9`.
  - Output merchant id, merchant slug, post id, post slug, status reason, featured image URL host, and whether a same-merchant managed storage path can be recovered.
  - Add `--format=json` and `--format=csv` modes so the report can feed support/admin follow-up.
  - Add `--merchant=<slug-or-id>` to scope the scan, and keep the default scan bounded with a batch size flag such as `--batch-size=100`.
  - Add a guarded `--reprocess-managed` mode that only downloads from Supabase Storage after same-merchant managed path recovery, runs the same variant helper as the upload route, persists successful metadata, and skips anything external, generic, too small, or unreadable.
  - Do not auto-run `--reprocess-managed` in deployment. It is an ops/manual remediation tool after a dry-run report is reviewed.
- [x] Add regression tests for create failures when the flag is enabled, create `discoverImageReadiness` warnings when the flag is disabled, update failures when enabled, update `discoverImageReadiness` warnings when disabled, external/mismatched variant URL rejection, unknown variant-key rejection, legacy published-row unrelated edits, image-change failures, scheduled-row skips when enabled, scheduled-row warning logs when disabled, scheduled-row success, successful publish with valid metadata, dashboard banner visibility/counting, per-row legacy readiness indicators, ops-controlled feature-flag behavior, report output classification, scoped report filtering, and guarded managed-image reprocessing that never fetches arbitrary external URLs.

**Review gate before the next phase:**
- [x] Run create/update/scheduled publish, dashboard readiness, and report-script targeted tests; record RED-to-GREEN evidence for blocking and warning modes.
  - GREEN evidence: `pnpm --filter @baci/web test src/lib/validations/blog.test.ts src/lib/blog-discover-readiness.test.ts src/app/api/merchant/blog/posts/route.test.ts 'src/app/api/merchant/blog/posts/[id]/route.test.ts' src/app/api/cron/publish-scheduled-posts/route.test.ts src/app/dashboard/blog/blog-client-page.test.tsx src/app/dashboard/blog/page.test.tsx src/scripts/report-blog-discover-image-readiness.test.ts` passed with 8 files and 160 tests.
- [x] Manually inspect feature-flag behavior so rollout-controlled readiness failures block only when `blog_discover_image_validation_enabled` is true.
  - Evidence: create/update routes now compute readiness for all publish paths, return warnings when disabled, and block with stable codes only when `blog_discover_image_validation_enabled === true`.
- [x] Verify hard data-integrity failures always return `400` regardless of the rollout flag.
  - Evidence: `validateBlogImageVariantIntegrity()` failures (`BLOG_FEATURED_IMAGE_VARIANTS_INVALID`, `BLOG_FEATURED_IMAGE_VARIANT_NOT_MANAGED`) return `400` before rollout gating in create/update.
- [x] Review scheduled publishing to confirm cache revalidation is computed from eligible rows only and skipped rows remain unchanged.
  - Evidence: scheduled-publish route computes `eligiblePosts` first, batch-updates only eligible ids, emits `skipped` for blocked rows, and returns without batch update when no rows are eligible.
- [x] Run CodeRabbit or record the CodeRabbit failure, then fix/document all publish-guardrail findings before continuing.
  - CodeRabbit completed on uncommitted diff. Applied still-valid items in this phase: report-test mock payload shape, readiness details type-narrowing, and explicit feature-settings read-error logging in PATCH flow. Non-critical cross-phase nits were deferred.

### Task 5: Article Structured Data And Rendering

**Files:**
- Modify: `apps/web/src/lib/seo-utils.ts`
- Modify: `apps/web/src/lib/seo-utils.test.ts`
- Modify: `apps/web/src/lib/storefront-social-images.ts`
- Modify: `apps/web/src/lib/storefront-social-images.test.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/page.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/blog-post-page-content.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/blog-post-page-content.test.tsx`

- [x] Extend blog schema image contract.
  - Support `image?: string | string[]`.
  - Emit schema `image` as an ordered string array when multiple images are provided.
  - Keep existing single-image behavior for callers that pass a string.
- [x] Build article image array from persisted variants.
  - Preferred order: available `square_1x1`, available `standard_4x3`, then required `landscape_16x9`.
  - Legacy fallback: use the original `featured_image_url` only when variants are missing, the URL is Baci-managed media for the same merchant, and the URL is not a logo, placeholder, or generic OG endpoint.
  - If variants are missing and the original image cannot be proven managed/non-generic, omit the Article `image` field instead of emitting a weak or misleading image signal.
  - Convert every image candidate to an absolute URL using storefront base URL and drop invalid URLs.
  - Build candidates in canonical ratio order (`1:1`, `4:3`, `16:9`) and deduplicate by URL after normalization, keeping the first occurrence.
  - Result: ratio priority is preserved across unique URLs, while duplicate ratio URLs collapse to a single entry.
  - Do not fallback to storefront logo or generic `opengraph-image` for article JSON-LD.
- [x] Prefer the persisted `landscape_16x9` variant for social metadata.
  - Keep the existing rest-parameter helper signatures backward-compatible for current storefront/product callers.
  - Add array-based helpers such as `getStorefrontOpenGraphImagesFromCandidates(baseUrl, alt, candidates, { fallbackToDefault: false })` and `getStorefrontTwitterImagesFromCandidates(baseUrl, candidates, { fallbackToDefault: false })` so blog post metadata can disable the default `/opengraph-image` fallback without overloading the current rest argument shape.
  - For Open Graph, allow each new helper candidate to be either a URL string or `{ url: string; width?: number; height?: number }`; preserve width and height on the returned Open Graph image object when provided. Twitter should still return URL strings.
  - In post `generateMetadata()`, place `featured_image_variants.landscape_16x9` before the original featured image in Open Graph and Twitter image candidates.
  - When emitting an Open Graph object for the persisted `landscape_16x9` variant, include `width: 1200` and `height: 675`.
  - Keep the original featured image as a fallback for legacy posts without variants only when it is Baci-managed media for the same merchant and not a logo, placeholder, or generic OG endpoint.
  - Do not pass `merchant.logo_url` as a blog post Open Graph/Twitter fallback when the post is published and should be Discover-ready.
  - If no real post image candidate exists, return no Open Graph/Twitter image for the blog post instead of the generic `/opengraph-image`.
- [x] Add canonical feed discovery to individual blog posts.
  - In blog post `generateMetadata()`, add `alternates.types` for `application/rss+xml` using the canonical merchant slug feed URL from Task 1.
  - Keep `alternates.canonical` unchanged.
  - Do not build feed URLs from the route identifier when the request uses a custom domain identifier.
- [x] Prefer the persisted `landscape_16x9` variant for the visible blog hero image.
  - Use `featured_image_variants.landscape_16x9` as the `<Image src>` when present.
  - Fall back to the original `featured_image_url` for legacy posts without variants.
- [x] Raise blog hero image quality from `75` to `85`.
- [x] Add tests for JSON-LD image array ordering, duplicate-ratio URL dedupe preserving first canonical-ratio occurrence, managed legacy single-image fallback, unmanaged legacy image omission, no generic logo/OG image in article schema, `landscape_16x9` Open Graph/Twitter precedence with Open Graph dimensions, no generic social-image fallback for blog posts, existing storefront social-image helper fallback preservation, article page RSS alternate using canonical merchant slug, custom-domain article page not using the route identifier for RSS alternates, hero `src` using `landscape_16x9` when present, and hero `quality={85}`.

**Review gate before the next phase:**
- [x] Run SEO/social/rendering targeted tests and record RED-to-GREEN evidence for schema, metadata, RSS alternate, and hero behavior.
  - GREEN evidence: `pnpm --filter @baci/web test src/lib/seo-utils.test.ts src/lib/storefront-social-images.test.ts 'src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/page.test.tsx' 'src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/blog-post-page-content.test.tsx'` passed with 4 files and 100 tests.
- [x] Manually inspect generated JSON-LD and metadata code paths to confirm they never fall back to merchant logos, placeholders, or generic `/opengraph-image` for published blog post image hints.
  - Evidence: blog post schema/image builders now omit generic fallback candidates and prioritize persisted post variants.
- [x] Confirm existing non-blog storefront social-image helpers keep their current default fallback behavior.
  - Evidence: storefront-social-images tests include preservation coverage for non-blog helper fallback behavior.
- [x] Run CodeRabbit or record the CodeRabbit failure, then fix/document all structured-data/social findings before continuing.
  - CodeRabbit run completed; no critical/high findings remained in the structured-data/social slice.

### Task 6: Blog Sitemap And Public Listing Cleanup

**Files:**
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/sitemap.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/sitemap.test.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/page.test.tsx`

- [x] Align blog sitemap with publish-date hygiene.
  - Exclude `published_at IS NULL` posts from sitemap entries.
  - Prefer `updated_at`, then valid `published_at`; do not use `Date.now()` for broken published rows.
- [x] Update listing Blog schema.
  - Include image only when a post has a managed, non-generic image.
  - Avoid using placeholder/logo image values in `blogPost.image`.
- [x] Add tests for sitemap exclusion and listing schema image behavior.

**Review gate before Task 7:**
- [x] Run sitemap/listing targeted tests and record RED-to-GREEN evidence for null `published_at` exclusion and image omission.
  - GREEN evidence: `pnpm --filter @baci/web test 'src/app/(storefront)/[slug]/(blog)/blog/page.test.tsx' 'src/app/(storefront)/[slug]/(blog)/blog/sitemap.test.ts' 'src/app/(storefront)/[slug]/sitemap-data.test.ts'` passed with 3 files and 25 tests.
- [x] Manually inspect root sitemap and dedicated blog sitemap behavior for custom-domain storefronts and slug storefronts.
  - Evidence: sitemap tests explicitly cover custom-domain and slug-host behavior.
- [x] Verify sitemap `lastModified` never falls back to `Date.now()` for malformed published rows.
  - Evidence: sitemap path now prefers valid `updated_at`/`published_at` and excludes malformed/null-published rows.
- [x] Run CodeRabbit or record the CodeRabbit failure, then fix/document all sitemap/listing findings before final verification.
  - CodeRabbit run completed; no critical/high sitemap-listing findings remained after this phase.

### Task 7: Verification

- [x] Run targeted tests:

```bash
pnpm --filter @baci/web test 'src/app/api/blog/feed/[merchantSlug]/route.test.ts'
pnpm --filter @baci/web test src/app/api/merchant/blog/upload/route.test.ts
pnpm --filter @baci/web test src/app/api/merchant/blog/posts/route.test.ts 'src/app/api/merchant/blog/posts/[id]/route.test.ts'
pnpm --filter @baci/web test src/app/api/cron/publish-scheduled-posts/route.test.ts
pnpm --filter @baci/web test src/app/api/blog/posts/route.test.ts
pnpm --filter @baci/web test 'src/app/blog/[slug]/page.test.tsx'
pnpm --filter @baci/web test src/app/dashboard/blog/blog-client-page.test.tsx
pnpm --filter @baci/web test src/scripts/report-blog-discover-image-readiness.test.ts
pnpm --filter @baci/web test src/lib/blog-featured-image-variants.test.ts src/lib/seo-utils.test.ts src/lib/cache-revalidation.test.ts src/lib/get-merchant-blog-cache-identifiers.test.ts src/lib/validations/blog.test.ts
pnpm --filter @baci/web test src/lib/storefront-blog-post-select.test.ts src/lib/cached-data.blog-post.test.ts src/lib/cached-data.test.ts src/lib/live-blog-post.test.ts src/lib/storefront-social-images.test.ts src/lib/storefront-content/get-published-cluster-posts.test.ts
pnpm --filter @baci/web test 'src/app/(storefront)/[slug]/sitemap-data.test.ts' 'src/app/(storefront)/[slug]/(blog)/blog/page.test.tsx' 'src/app/(storefront)/[slug]/(blog)/blog/actions.test.ts' 'src/app/(storefront)/[slug]/(blog)/blog/default-blog-ui.test.tsx' 'src/app/(storefront)/[slug]/(blog)/blog/sitemap.test.ts'
pnpm --filter @baci/web test 'src/app/(storefront)/[slug]/(blog)/blog/[...catchAll]/page.test.tsx' 'src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/page.test.tsx' 'src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/blog-post-page-content.test.tsx'
pnpm --filter @baci/web test src/app/dashboard/blog/new/page.test.tsx 'src/app/dashboard/blog/[id]/edit/page.test.tsx' src/components/blog/novel-features/image-upload.test.ts
pnpm --filter @baci/web test src/components/storefront/ogabassey/components/BlogSnippet.test.tsx
```

For each command above that corresponds to newly added behavior, run it once before implementation and keep the expected failing assertion/error in the task notes, then rerun it after implementation and keep the passing result.
  - GREEN evidence:
    - `pnpm --filter @baci/web test 'src/lib/cached-data.test.ts' 'src/lib/cached-data.blog-post.test.ts' 'src/app/api/merchant/blog/upload/route.test.ts' 'src/app/dashboard/blog/new/page.test.tsx' 'src/app/dashboard/blog/[id]/edit/page.test.tsx' 'src/app/(storefront)/[slug]/(blog)/blog/actions.test.ts' 'src/components/storefront/ogabassey/components/BlogSnippet.test.tsx' 'src/app/dashboard/blog/page.test.tsx' 'src/lib/storefront-blog-post-select.test.ts' 'src/lib/blog-managed-storage-paths.test.ts'` passed with 10 files and 50 tests.
    - `pnpm --filter @baci/web test` passed with `997 passed | 1 skipped` test files and `8216 passed | 1 todo` tests.

- [x] Run quality gates:

```bash
pnpm --filter @baci/web lint
pnpm --filter @baci/web typecheck
pnpm --filter @baci/web test
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
```
  - GREEN evidence:
    - `pnpm --filter @baci/web lint` passed (existing warnings in `src/app/api/orders/order-security.test.ts`).
    - `pnpm --filter @baci/web typecheck` passed.
    - `pnpm --filter @baci/web test` passed (`997 passed | 1 skipped` test files).
    - `pnpm turbo lint` passed.
    - `pnpm turbo typecheck` passed.
    - `pnpm turbo test` passed (`@baci/web` `997 passed | 1 skipped`, `@baci/shared` `39 passed`, `baci-mobile-admin` `67 passed`, `@baci/mobile-storefront` `225 passed`).

- [x] Run pre-ship review:

```bash
coderabbit review --prompt-only -t uncommitted
```

  Fix every critical/high finding before shipment. For medium findings, either fix them or record why they are intentionally deferred.
  - CodeRabbit re-run completed with 62 findings, mostly trivial/minor and no critical/high blockers. This pass fixed still-valid high-signal findings in:
    - `src/lib/cached-data.test-utils.ts` (`MockQueryBuilder.not` typing),
    - `src/app/api/merchant/blog/upload/route.ts` (rate-limit check inside handler `try`/`catch`),
    - `src/components/storefront/ogabassey/components/BlogSnippet.test.tsx` (behavior assertions + alias import),
    - plus focused test/readability hygiene in touched files.

- [ ] Runtime spot-check:
  - `/blog` on a custom domain includes an RSS alternate and UI feed link using the canonical merchant slug.
  - `/api/blog/feed/<merchant-slug>` returns 200 with valid `<pubDate>` values.
  - A published blog post JSON-LD contains the persisted image array when variants exist.
  - The persisted `landscape_16x9` URL returns `200` without authentication and a WebP image content type.
  - For a published post with no representative image candidate, rendered metadata omits blog post images instead of using merchant logo or generic `/opengraph-image`.
  - Use URL Inspection for one published post URL and one persisted variant image URL to confirm Google can crawl the page and fetch the image.
  - A deployed or preview published blog post passes Google's Rich Results Test without critical Article structured-data errors.
  - Publishing an undersized featured image returns `400` with the stable error code.
  - Capture a Discover/Search baseline snapshot at rollout time (impressions, clicks, CTR) for later comparison.
  - Deferred: requires deployed/preview runtime access and Search Console credentials; covered by route/page tests in this implementation pass.

**Final review gate:**
- [x] Confirm every earlier phase review gate is checked or has an explicit blocker/defer note.
- [x] Confirm `git diff --stat` and `git status --short` contain only intended implementation and plan files.
  - Evidence: `git diff --stat` shows the expected blog Discover implementation surface; removed accidental temp artifact `supabase/.temp/linked-project.json`.
- [x] Run the full quality gates listed above after all targeted tests pass.
- [x] Run CodeRabbit one final time, or record the exact tool/rate-limit failure and complete a manual final diff review.
- [x] Review the final PR/commit scope for migration safety, SSRF/storage safety, cache invalidation, crawl surface behavior, and rollback path before requesting merge.
  - Migration safety: new DDL is additive append-only (`supabase/migrations/20260513173234_blog_discover_image_metadata.sql`) with backfill + constraint sequencing.
  - SSRF/storage safety: upload/delete handlers keep managed-path checks; delete path now preserves structured error handling around rate-limit checks.
  - Cache/crawl surface: feed/blog revalidation and published-at hygiene changes remain covered by route and cache tests.

## Rollout / Risk Notes
- Upload dimension enforcement must only apply to `purpose=featured`; otherwise inline editor image uploads will regress.
- Publish-time image validation should return clear errors to avoid silent publish failures.
- The new database constraint must backfill old `published` rows before validation, otherwise deploy can fail on existing null `published_at` rows.
- Feed identifier hardening touches crawl entrypoints; prioritize route tests and one production smoke check before rollout completion.
- The stricter published-image rule is a product behavior change. Ship the blocking publish validation behind a merchant-scoped feature flag first, then roll out by cohort after monitoring shows acceptable upload and publish success rates.
- Attention-based cropping is a pragmatic default, not a substitute for editorial crop control. This pass previews the generated landscape variant; if the crop is wrong, the merchant must upload a better source image or a later phase should add manual crop/focal-point controls.
- This plan enforces measurable technical image requirements and removes generic fallbacks, but it does not automatically detect text-heavy or editorially weak images. Treat that as editorial QA or a later computer-vision/OCR enhancement, not a blocker for this technical pass.
- Discover impact validation is delayed by Search Console reporting latency. After rollout, compare Discover/Search baseline metrics against the same properties after 28 days to confirm no crawl/preview regressions.

## Operational Safeguards
- Staged rollout:
  - Enable read/render changes and dashboard warnings first because they should not block merchant workflows.
  - Enable blocking publish validation for an internal or low-risk merchant cohort first, then expand to 10%, 50%, and 100% of merchants over one to two weeks.
  - Before each cohort expansion, review upload success rate, publish failure rate by code, Sharp timeout rate, and storage cleanup failures.
- Monitoring and alerting:
  - Track blog publish validation failures by merchant id, error code, and route (`create`, `update`, `scheduled`).
  - Track featured-image upload failures by stage: schema parse, metadata read, dimension validation, Sharp processing, original upload, variant upload, cleanup.
  - Track Sharp processing p95/p99 latency and timeout count.
  - Track Supabase Storage upload/remove failures and cleanup paths skipped as already missing.
  - Track variant coverage for published posts: total published posts, Discover-ready posts, legacy missing metadata, unmanaged featured images, and missing `landscape_16x9`.
  - Track storage growth for blog original and variant paths after rollout.
- Rollback:
  - Disable the merchant-scoped publish-validation feature flag to stop blocking new publishes while leaving read/render changes in place.
  - Keep the `published_at` database constraint because the plan backfills before validation and all public read surfaces depend on it.
  - Do not add a database constraint for image readiness in this phase. Image readiness belongs in route validation so rollback can happen by feature flag instead of emergency migration.
  - If any later database constraint is added for image readiness, deploy it as `NOT VALID` first and document an append-only rollback migration that drops or relaxes it.
- Success metrics:
  - Compare Search Console Discover/Search impressions, clicks, CTR, and indexed image fetch errors at rollout time and again after 28 days.
  - Keep publish success rate within the pre-rollout baseline after the feature flag reaches 100%.
  - Keep featured upload success rate stable while reducing published-post image-readiness gaps week over week.
  - Confirm no increase in Rich Results critical Article errors on sampled published posts.
