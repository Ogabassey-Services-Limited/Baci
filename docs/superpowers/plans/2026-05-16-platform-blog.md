# Platform Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILLS: Use `superpowers:test-driven-development` for every code/SQL behavior change, then execute task-by-task with `superpowers:subagent-driven-development` (recommended in this session) or `superpowers:executing-plans` (fallback for a separate execution session). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Stand up a real Baci platform blog at `/blog` + `/blog/[slug]` by reusing the merchant blog data model, Discover pipeline (PR #1637), and OG image pattern (PR #1658). Replace the hardcoded placeholder index that currently 404s on click and pollutes the sitemap with three fake URLs.

**Architecture:** The `blog_posts` table already supports platform posts (`is_platform_post = true AND merchant_id IS NULL`, enforced by `chk_platform_post_merchant`). This is a wiring + authoring-surface project, not a greenfield build. Platform authoring lives under the existing `/admin` surface gated by `getPlatformAdminAuth()`. Rendering reuses the merchant blog schema/SEO generators via a **synthetic platform-blog context** rather than refactoring the merchant render path (lower risk to the live merchant blog).

**Tech stack:** Next.js 16 App Router, TypeScript, Supabase/Postgres, Sharp (already a dep from #1637), Zod, Vitest, Biome, Schema.org JSON-LD.

---

## Execution Discipline
- **TDD is mandatory.** For each task that changes runtime behavior, write the focused failing test first, run it and confirm the expected RED failure, implement the minimum change, then rerun to GREEN. Do not write production code first and backfill tests.
- **Migrations/RLS are TDD too.** Before adding the migration, add the focused SQL/local-stack checks for policy existence plus positive and negative cases; confirm the relevant check fails before the migration and passes after it.
- **Use subagent-driven development by default.** This plan has enough independent slices (DB/RLS, query/cache, public routes, OG image, admin API/UI, verification) to benefit from a fresh implementer subagent per task plus spec-review and code-quality review loops. Run tasks sequentially, not in parallel, because they share files and cache/storage contracts.
- **Fallback:** If subagents are unavailable, use `superpowers:executing-plans` inline, but preserve the same RED/GREEN evidence and review checkpoints before marking each task complete.

## Source Notes (repo-verified 2026-05-16, against `origin/main` @ `1211be358e`, including PR #1658 merge `dcfa2e2d67`)
- `blog_posts` has `is_platform_post boolean DEFAULT false` and `CONSTRAINT chk_platform_post_merchant` permitting `(is_platform_post=true, merchant_id IS NULL)`. Schema was designed for this; live row-count verification is listed below.
- Discover columns from PR #1637 (`featured_image_width/height`, `featured_image_variants jsonb`) are on the same table — platform posts inherit them for free.
- Access control primitive exists: `apps/web/src/lib/platform-admin-auth.ts` → `getPlatformAdminAuth()` checks the current user's merchant row for `is_platform_admin = true`. It is currently used by `apps/web/src/app/admin/layout.tsx`; most existing `/api/admin/*` routes duplicate the auth/admin check inline. **No `/api/admin/blog` exists yet.**
- `apps/web/src/app/admin/*` is an established admin app (analytics, merchants, notifications, settings, system, templates) — the authoring surface mirrors this.
- Render component `(storefront)/[slug]/(blog)/blog/[postSlug]/blog-post-page-content.tsx` is **merchant-coupled**: uses `buildStoreUrl(merchant)`, `buildCanonicalBlogPostUrl(merchant, …)`, `isDomainIdentifier(slug)`, `merchant.{business_name,logo_url,slug,id}`. Not reusable as-is.
- Live SEO bleed: `apps/web/src/app/sitemap.ts:28-43` (`fetchBlogPosts()`) emits 3 fake slugs + `/blog` (priority 0.8) to Google; `apps/web/src/app/blog/[slug]/page.tsx` `.eq('is_platform_post', true)` → always `notFound()`.
- Dead `platform_blog_posts` table: live Supabase read-only check on 2026-05-16 returned 0 rows; `blog_posts` also had 0 platform rows. Repo refs are only schema/RLS/grant definitions. Keep the migration guard because production data can drift after this review.
- Existing `blog_posts` RLS is **not** sufficient for admin writes to platform rows: `SELECT` is currently `USING (true)`, while insert/update/delete policies are merchant-scoped and reject `merchant_id IS NULL`. Public queries must keep explicit `status='published'` + `published_at IS NOT NULL` filters; new platform-admin write policies are required.
- Existing `storage.objects` blog-media policies only permit top-level folders that match merchant ids. A platform namespace like `platform/blog/...` needs its own platform-admin INSERT/UPDATE/DELETE policies or platform uploads, future upserts, and cleanup deletes will fail under RLS.
- Execution base guardrail: this working tree was on `fix/remove-dead-platform-blog` / local `main` at `90e179f644`, three commits behind `origin/main` (`1211be358e` at rereview). Implement from a fresh worktree at the latest `origin/main` or merge/rebase first, otherwise PR #1658's merchant blog OG files are missing locally.

## Non-goals
- Not building a CMS/rich editorial workflow (scheduling, multi-author roles beyond platform-admin, revisions). Reuse the existing simple authoring shape.
- Not changing `proxy.ts`, merchant blog routes, or merchant authoring (`/dashboard/blog`, `/api/merchant/blog/*`).
- Not refactoring `blog-post-page-content.tsx` shared with the live merchant blog (explicitly avoided — see Product Decision 1).
- Not editing existing migrations. All DB work append-only.
- Not writing editorial content — that's a separate, non-engineering track.

## Product Decisions
1. **Synthetic platform context over shared-component refactor.** Build a thin `PlatformBlogContext` (Baci business name, `usebaci.com` base URL, Baci logo, no merchant id) and platform-specific page/render rather than generalizing the merchant render component. The platform pages must keep `PlatformHeader` / `PlatformFooter` and must not import storefront chrome or merchant layout wrappers. Rationale: refactoring `blog-post-page-content.tsx` touches the live 248-post merchant blog and risks regressions for ~the same LOC as a parallel platform render; importing it also risks merchant-looking chrome on the public Baci blog. Revisit consolidation only if a third blog surface appears.
2. **Authoring under `/admin`, not `/dashboard`.** Platform posts are Baci-internal. Mirror `/api/merchant/blog/*` → `/api/admin/blog/*` and `/dashboard/blog` → `/admin/blog`, gated by `getPlatformAdminAuth()`. Never expose platform authoring to merchants.
3. **`is_platform_post=true AND merchant_id IS NULL` is the only platform predicate.** Every platform query filters all three: `is_platform_post=true`, `merchant_id IS NULL`, `status='published'` (public reads also `published_at IS NOT NULL`, matching #1637's constraint).
4. **Reuse Discover pipeline as-is.** Platform featured-image upload reuses the Sharp variant logic from `blog-featured-image-variants.ts`; publish guardrail reuses `blog-discover-readiness.ts`. No fork.
5. **Add the platform slug-uniqueness index now.** `blog_posts_merchant_id_slug_key UNIQUE(merchant_id, slug)` does not constrain platform rows (NULL merchant_id). Add the partial unique index as part of this work — it becomes load-bearing the moment platform posts exist.
6. **Drop the dead `platform_blog_posts` table** in the same migration — zero rows, zero app refs, removes a permanent source of "which table?" confusion for future agents.
7. **Treat `/api/blog/posts` as part of the public platform-blog surface.** It already reads `blog_posts` with `is_platform_post=true`; update it or intentionally retire it so it does not drift from the new shared query layer, tenant-null filter, and view-count behavior.
8. **Do not clone the dashboard blog UI wholesale.** `dashboard/blog/blog-client-page.tsx`, `new/page.tsx`, and `[id]/edit/page.tsx` are already 700-1400+ line files. Platform admin UI must be split into small route wrappers, focused client components/hooks, and shared helpers so new files stay under the repo's 300-line rule.
9. **Use persistent platform-blog caching, matching the merchant blog.** Platform listing/article queries should use Next remote cache (`'use cache: remote'`, `cacheLife('merchant')`, `cacheTag(...)`) instead of only React `cache(...)`, so Task 7's revalidation does real work. React `cache(...)` may still wrap request-local helper composition, but it is not the invalidation boundary.

## File Map
**DB**
- Create: `supabase/migrations/<ts>_platform_blog_setup.sql`

**Query / data layer**
- Create: `apps/web/src/lib/platform-blog.ts` (+ `.test.ts`) — `getPlatformBlogPost`, paginated `getPlatformBlogListing`, `getPlatformBlogFeedPosts`, `getPlatformBlogSitemapPosts`, `PLATFORM_BLOG_SELECT`, `PlatformBlogContext`
- Modify: `apps/web/src/lib/cache-revalidation.ts` (+ test) — platform blog tag/path invalidation

**Public routes (replace the dead placeholders)**
- Modify: `apps/web/src/app/blog/page.tsx` (+ create `.test.tsx`) — query `getPlatformBlogListing({ page })`, real empty-state
- Modify: `apps/web/src/app/blog/[slug]/page.tsx` (+ existing `.test.tsx`) — `getPlatformBlogPost`, JSON-LD via reused generators
- Create: `apps/web/src/app/blog/[slug]/opengraph-image.tsx` (+ tests) — port the #1658 sidecar pattern with `PlatformBlogContext`
- Create: `apps/web/src/app/blog/[slug]/opengraph-image-data.ts` (+ test)
- Create if view counts remain visible: `apps/web/src/app/blog/[slug]/actions.ts` + `view-counter.tsx` (+ tests) — reuse `increment_blog_post_views` with returned-error logging, or remove view-count UI from the platform article page
- Modify: `apps/web/src/app/api/blog/posts/route.ts` (+ test) — align existing public API with `getPlatformBlogPost` / `getPlatformBlogListing`, add `merchant_id IS NULL`, and avoid duplicated query/view-count drift
- Modify: `apps/web/src/app/sitemap.ts` (+ test) — replace `fetchBlogPosts()` placeholder with `getPlatformBlogSitemapPosts`; drop fake slugs
- Create: `apps/web/src/app/blog/feed.xml/route.ts` (+ test) — platform RSS (mirror `api/blog/feed/[merchantSlug]` minus tenant scoping, using `sanitizeForFeed`, RSS headers, and persistent `platform-blog-feed` cache tagging)

**Authoring (admin)**
- Create: `apps/web/src/app/api/admin/blog/posts/route.ts` (+ test) — POST/GET, `getPlatformAdminAuth()`, sets `is_platform_post: true, merchant_id: null`
- Create: `apps/web/src/app/api/admin/blog/posts/[id]/route.ts` (+ test) — GET/PATCH/DELETE
- Create: `apps/web/src/app/api/admin/blog/upload/route.ts` (+ test) — POST and DELETE, reuse `blog-featured-image-variants.ts`; store under a platform-scoped storage path; require CSRF and upload rate limiting
- Create: `apps/web/src/app/admin/blog/page.tsx` + `new/page.tsx` + `[id]/edit/page.tsx` (+ tests) — small route wrappers only
- Create: focused admin UI helpers/components under `apps/web/src/app/admin/blog/` (+ tests) — list client, form client, API helpers, and shared types split so no new runtime file exceeds 300 lines
- Modify: `apps/web/src/lib/blog-managed-storage-paths.ts` (+ test) — add `PLATFORM_BLOG_MEDIA_PREFIX = 'platform/blog'` and a typed platform storage scope so upload paths, managed-path validation, CDN URL building, and OG SSRF checks agree on the same prefix
- Modify: `apps/web/src/lib/blog-discover-readiness.ts` (+ test) — validate platform featured image URLs/variants against the same typed storage scope, not a fake merchant id
- Modify on `origin/main`: `apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-loader.ts` and `opengraph-image-security.ts` (+ tests) — accept the platform storage scope without weakening merchant SSRF checks

**Validation / shared**
- Modify if needed: `apps/web/src/lib/validations/blog.ts` (+ test) — current schemas do not include `merchant_id`; only add platform-specific schema changes if the storage-scope or publish guardrail requires them
- Modify: `apps/web/src/components/platform/footer.tsx` — keep the `/blog` link (now valid); add to platform nav if desired
- Modify: `apps/web/src/config/llms-links.ts` — `PLATFORM_OPTIONAL_LINKS` Blog entry is now accurate; no change needed (verify)

## Implementation Plan

### Task 1: Database foundation
- [ ] Create append-only migration `<ts>_platform_blog_setup.sql`:
  - Generate it with `supabase migration new platform_blog_setup`; do not invent a timestamp by hand.
  - `CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_platform_slug_unique ON public.blog_posts (slug) WHERE is_platform_post IS TRUE AND merchant_id IS NULL;`
  - Add required platform-admin write policies on `blog_posts` (existing RLS does **not** allow `merchant_id IS NULL` writes):
```sql
DROP POLICY IF EXISTS "Platform admins can insert platform blog posts" ON public.blog_posts;
CREATE POLICY "Platform admins can insert platform blog posts"
ON public.blog_posts
FOR INSERT
TO authenticated
WITH CHECK (
  is_platform_post IS TRUE
  AND merchant_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.merchants
    WHERE merchants.user_id = auth.uid()
      AND merchants.is_platform_admin IS TRUE
  )
);

DROP POLICY IF EXISTS "Platform admins can update platform blog posts" ON public.blog_posts;
CREATE POLICY "Platform admins can update platform blog posts"
ON public.blog_posts
FOR UPDATE
TO authenticated
USING (
  is_platform_post IS TRUE
  AND merchant_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.merchants
    WHERE merchants.user_id = auth.uid()
      AND merchants.is_platform_admin IS TRUE
  )
)
WITH CHECK (
  is_platform_post IS TRUE
  AND merchant_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.merchants
    WHERE merchants.user_id = auth.uid()
      AND merchants.is_platform_admin IS TRUE
  )
);

DROP POLICY IF EXISTS "Platform admins can delete platform blog posts" ON public.blog_posts;
CREATE POLICY "Platform admins can delete platform blog posts"
ON public.blog_posts
FOR DELETE
TO authenticated
USING (
  is_platform_post IS TRUE
  AND merchant_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.merchants
    WHERE merchants.user_id = auth.uid()
      AND merchants.is_platform_admin IS TRUE
  )
);
```
  - Drop dead artifacts only after the guard below passes (drops its RLS policies, indexes, grants, and FK with it):
```sql
DO $$
DECLARE
  platform_blog_post_count bigint := 0;
BEGIN
  IF to_regclass('public.platform_blog_posts') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.platform_blog_posts'
      INTO platform_blog_post_count;

    IF platform_blog_post_count <> 0 THEN
      RAISE EXCEPTION 'Refusing to drop public.platform_blog_posts because it contains % rows', platform_blog_post_count;
    END IF;
  END IF;
END $$;

DROP TABLE IF EXISTS public.platform_blog_posts CASCADE;
```
  - Add storage policies for the platform blog media namespace. Current blog-media policies allow writes only under merchant-id folders; platform uploads under `platform/blog/...` need explicit RLS:
```sql
DROP POLICY IF EXISTS "Platform admins can upload platform blog media" ON storage.objects;
CREATE POLICY "Platform admins can upload platform blog media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = 'platform'
  AND (storage.foldername(name))[2] = 'blog'
  AND EXISTS (
    SELECT 1
    FROM public.merchants
    WHERE merchants.user_id = auth.uid()
      AND merchants.is_platform_admin IS TRUE
  )
);

DROP POLICY IF EXISTS "Platform admins can update platform blog media" ON storage.objects;
CREATE POLICY "Platform admins can update platform blog media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = 'platform'
  AND (storage.foldername(name))[2] = 'blog'
  AND EXISTS (
    SELECT 1
    FROM public.merchants
    WHERE merchants.user_id = auth.uid()
      AND merchants.is_platform_admin IS TRUE
  )
)
WITH CHECK (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = 'platform'
  AND (storage.foldername(name))[2] = 'blog'
  AND EXISTS (
    SELECT 1
    FROM public.merchants
    WHERE merchants.user_id = auth.uid()
      AND merchants.is_platform_admin IS TRUE
  )
);

DROP POLICY IF EXISTS "Platform admins can delete platform blog media" ON storage.objects;
CREATE POLICY "Platform admins can delete platform blog media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = 'platform'
  AND (storage.foldername(name))[2] = 'blog'
  AND EXISTS (
    SELECT 1
    FROM public.merchants
    WHERE merchants.user_id = auth.uid()
      AND merchants.is_platform_admin IS TRUE
  )
);
```
  - Keep the SQL path predicate byte-for-byte aligned with the TypeScript storage prefix: SQL checks `(storage.foldername(name))[1] = 'platform'` and `[2] = 'blog'`; TypeScript defines `PLATFORM_BLOG_MEDIA_PREFIX = 'platform/blog'`; upload and cleanup routes must write only `${PLATFORM_BLOG_MEDIA_PREFIX}/...`.
  - No changes to `blog_posts` columns — they already exist.
- [ ] Confirm RLS in tests or a local Supabase stack: public reads still rely on application filters for `status='published'` / `published_at IS NOT NULL`, authenticated platform admins can create/update/delete only `is_platform_post=true AND merchant_id IS NULL` rows, and authenticated platform admins can upload/update/delete only `media/platform/blog/...` storage objects. Add negative checks that anon users and authenticated non-`is_platform_admin` users are rejected for platform-post INSERT/UPDATE/DELETE and `media/platform/blog/...` storage INSERT/UPDATE/DELETE.
- [ ] Verify the `EXISTS (SELECT 1 FROM public.merchants WHERE merchants.user_id = auth.uid() AND merchants.is_platform_admin IS TRUE)` policy predicate resolves under `merchants` RLS for a real platform-admin user; failure mode should be explicit, not silently returning false.

### Task 2: Platform query + context layer
- [ ] `apps/web/src/lib/platform-blog.ts`:
  - `PLATFORM_BLOG_SELECT` — mirror `STOREFRONT_BLOG_POST_SELECT` (includes Discover variant columns).
  - `PlatformBlogContext` — `{ businessName: 'Baci', baseUrl: <usebaci.com>, logoUrl, slug: null }` (the synthetic context).
  - Define cache tags: `PLATFORM_BLOG_CACHE_TAG = 'platform-blog'`, `PLATFORM_BLOG_LIST_CACHE_TAG = 'platform-blog-list'`, `PLATFORM_BLOG_SITEMAP_CACHE_TAG = 'platform-blog-sitemap'`, `getPlatformBlogPostCacheTag(slug)`, and `getPlatformBlogListCacheTag(page)`.
  - `getPlatformBlogPost(slug)` — filters `is_platform_post=true`, `.is('merchant_id', null)`, `status='published'`, `published_at IS NOT NULL`; `.maybeSingle()`. Use `'use cache: remote'`, `cacheLife('merchant')`, and `cacheTag(PLATFORM_BLOG_CACHE_TAG, getPlatformBlogPostCacheTag(slug))`.
  - `getPlatformBlogListing({ page = 1, limit = BLOG_LISTING_PAGE_SIZE } = {})` — published platform posts, ordered by `published_at desc`, defaulting to the existing `BLOG_LISTING_PAGE_SIZE` from `apps/web/src/lib/blog-listing-page-size.ts` so `/blog` does not accidentally render every future post. Use `'use cache: remote'`, `cacheLife('merchant')`, and attach all relevant tags: `cacheTag(PLATFORM_BLOG_CACHE_TAG, PLATFORM_BLOG_LIST_CACHE_TAG, getPlatformBlogListCacheTag(page))`.
  - `getPlatformBlogFeedPosts()` — published platform posts, ordered by `published_at desc`, `.limit(50)`, for RSS only.
  - `getPlatformBlogSitemapPosts()` — published platform posts, ordered by `published_at desc`, selecting only `slug, published_at, updated_at` for sitemap generation. Use `'use cache: remote'`, `cacheLife('merchant')`, and `cacheTag(PLATFORM_BLOG_CACHE_TAG, PLATFORM_BLOG_SITEMAP_CACHE_TAG)`.
  - For RSS/feed caching, use a persistent Next cache (`unstable_cache` with `tags: ['platform-blog-feed']` or a `'use cache: remote'` helper with `cacheTag('platform-blog-feed')`). Do **not** rely on React `cache(...)` for tag revalidation; it is request-scoped only.
  - Reuse `createPublicClient` from `@/lib/supabase/public` with a platform-blog `clientInfo` and explicit timeout.
- [ ] Tests: filters enforced together; draft/unpublished/merchant rows excluded; listing is paginated, feed is capped at 50, sitemap uses a lean select, `BLOG_LISTING_PAGE_SIZE` is reused from the existing constant, and persistent post/list/feed cache tags line up with `revalidatePlatformBlog`.

### Task 3: Public reading surface
- [ ] Rewrite `apps/web/src/app/blog/page.tsx` — server component, `getPlatformBlogListing({ page })`, real empty-state ("No posts yet"), remove the hardcoded array, and keep pagination explicit even if only page 1 is rendered initially. Add colocated test.
- [ ] Upgrade `/blog` metadata to match the merchant blog listing shape: canonical `/blog`, `openGraph.type='website'`, Twitter summary image fallback, RSS alternate `application/rss+xml: /blog/feed.xml`, robots with `max-image-preview: large`, and JSON-LD scripts for `Blog` + breadcrumb serialized with `safeJsonLdStringify`.
- [ ] Rewrite `apps/web/src/app/blog/[slug]/page.tsx` — `getPlatformBlogPost`, `notFound()` only on real miss. The listing and article pages are intentionally ISR/tag-cache backed through Task 2's persistent platform-blog cache tags, not purely dynamic DB reads. Emit JSON-LD via the existing `generateBlogPostSchema` / `generateBreadcrumbSchema` (they take data, not a merchant — pass `PlatformBlogContext` values) and serialize with `safeJsonLdStringify`. Update existing `page.test.tsx`.
- [ ] Keep platform chrome explicit on both `/blog` and `/blog/[slug]`: use `PlatformHeader` and `PlatformFooter` from `apps/web/src/components/platform/*`; do not import merchant storefront layout, themed storefront components, or storefront route wrappers.
- [ ] Reuse the article body renderer: extract the merchant render's presentational JSX into a context-agnostic `BlogArticleBody` if cheap, OR inline a platform-specific render. Decision per Product Decision 1 — prefer a small platform render that calls shared schema generators.
- [ ] Resolve view count deliberately: either add platform `ViewCounter`/server action around `increment_blog_post_views` (with the PR #1655 returned-error logging pattern), or remove view counts from the platform page. Do not leave the current stale "incremented via API route" comment after the page uses direct server data.
- [ ] Preserve `robots: { 'max-image-preview': 'large' }`, `og:type=article`, canonical — copy the merchant metadata shape with platform URLs.

### Task 4: Platform OG image (closes deferred Item 2)
- [ ] Port the #1658 sidecar pattern: `opengraph-image.tsx` + `opengraph-image-data.ts` under `app/blog/[slug]/`.
  - `contentType='image/png'`, `size=1200x630`, `runtime='nodejs'`, `revalidate=0` + no-store (match #1658's transient-retry decision).
  - Reuse the #1658 files on `origin/main`: `opengraph-image-loader.ts`, `opengraph-image-security.ts`, `opengraph-image-colors.ts`, and tests. Generalize `isAllowedBlogOgImageUrl` / `loadFeaturedImage*` to accept a typed merchant-or-platform storage scope, OR add a separate platform predicate. Keep the `.webp` skip from #1658's `isLikelySatoriSupportedRasterUrl` logic (currently private in the merchant data file, so export it or duplicate it with tests).
  - Full-bleed editorial layout, Baci branding (no merchant brand colors). Reuse the layout structure from #1658.
- [ ] `generateImageMetadata` for per-post alt. Tests mirror #1658's suite.

### Task 5: Sitemap + RSS
- [ ] `apps/web/src/app/sitemap.ts`: delete `fetchBlogPosts()` placeholder; replace the dynamic-posts block with `getPlatformBlogSitemapPosts()` mapping real slugs + `updated_at ?? published_at`. Keep `/blog` static entry only if listing is non-empty (or keep always at lower priority). Update `sitemap.test.ts` so `/blog` behavior is explicit and the three fake post URLs are no longer expected.
- [ ] Create `app/blog/feed.xml/route.ts` — platform RSS, mirror `api/blog/feed/[merchantSlug]/route.ts` minus tenant scoping; `published_at IS NOT NULL` guard; `sanitizeForFeed(post.content)`; skip malformed dates instead of failing; return `Content-Type: application/rss+xml; charset=utf-8`, `Cache-Control`, and `X-Content-Type-Options: nosniff`; cache tag `platform-blog-feed`.
- [ ] Update `apps/web/src/app/api/blog/posts/route.ts` or remove its old duplicate logic. If kept, it must call the shared platform query layer, filter `.is('merchant_id', null)`, keep safe pagination, and share the same view-count decision as Task 3.

### Task 6: Admin authoring
- [ ] `/api/admin/blog/posts` POST/GET + `[id]` GET/PATCH/DELETE — clone the merchant behavior, but replace merchant-access resolution with `getPlatformAdminAuth()` and map statuses consistently: `unauthenticated` → 401, `forbidden` → 403. For write methods, auth is first, CSRF is checked before body parsing/DB writes, and every mutation forces `is_platform_post: true, merchant_id: null` server-side.
- [ ] Reuse `validations/blog.ts` + `blog-discover-readiness.ts` publish guardrail with the new platform storage scope. Do not pass a fake merchant id to satisfy existing helpers.
- [ ] `/api/admin/blog/upload` — clone merchant upload POST **and DELETE** behavior; reuse `blog-featured-image-variants.ts`; store under `${PLATFORM_BLOG_MEDIA_PREFIX}/...` (extend `blog-managed-storage-paths.ts` with the platform namespace + predicate so the OG SSRF guard accepts it); apply CSRF and a platform-specific upload rate-limit key.
- [ ] `/admin/blog` UI — build small platform-specific wrappers/components that reuse `BlogEditor` and existing UI patterns, but do not paste the 700-1400 line dashboard files. Split list state, form submit logic, image upload/delete helpers, and route wrappers into focused files with colocated tests.
- [ ] On every successful write, call the cache-revalidation helper for platform paths.

### Task 7: Cache revalidation
- [ ] Extend `apps/web/src/lib/cache-revalidation.ts` with `revalidatePlatformBlog(slug?)`: `revalidateTag(PLATFORM_BLOG_CACHE_TAG, 'merchant')`, `revalidateTag(PLATFORM_BLOG_LIST_CACHE_TAG, 'merchant')`, `revalidateTag(PLATFORM_BLOG_SITEMAP_CACHE_TAG, 'merchant')`, `revalidateTag(getPlatformBlogPostCacheTag(slug), 'merchant')` when a slug is provided, `revalidateTag('platform-blog-feed', 'merchant')`, `revalidatePath('/blog')`, `revalidatePath('/blog/<slug>')`, `revalidatePath('/blog/<slug>/opengraph-image')`, `revalidatePath('/blog/feed.xml')`, and `revalidatePath('/sitemap.xml')`. The path calls are paired with Task 2's persistent cache tags; they must not be the only invalidation mechanism. Call from post create/update/delete and media changes that alter a saved post. Add test.

### Task 8: Verification
- [ ] Targeted tests:
```bash
pnpm --filter @baci/web test src/lib/platform-blog.test.ts src/lib/cache-revalidation.test.ts \
  'src/app/blog/page.test.tsx' 'src/app/blog/[slug]/page.test.tsx' \
  'src/app/blog/[slug]/opengraph-image-data.test.ts' 'src/app/blog/feed.xml/route.test.ts' \
  src/app/sitemap.test.ts \
  'src/app/api/blog/posts/route.test.ts' \
  'src/app/api/admin/blog/posts/route.test.ts' 'src/app/api/admin/blog/posts/[id]/route.test.ts' \
  'src/app/api/admin/blog/upload/route.test.ts' \
  src/lib/blog-managed-storage-paths.test.ts src/lib/blog-discover-readiness.test.ts
```
- [ ] Migration replay: `supabase db reset` locally, then run focused SQL checks that platform blog RLS and `storage.objects` platform media policies exist and enforce positive/negative cases. Verify anon + non-platform-admin users cannot write platform blog rows or `media/platform/blog/...` objects, while a platform-admin user can. Confirm the `merchants` RLS interaction does not make the admin `EXISTS` predicate silently false.
- [ ] Quality gates: `pnpm turbo lint && pnpm turbo typecheck && pnpm turbo test`.
- [ ] `coderabbit review --prompt-only -t uncommitted`.
- [ ] Manual: seed one platform post via `/admin/blog/new` (requires an `is_platform_admin=true` user); confirm `/blog` lists it, `/blog/<slug>` renders (no 404), `/blog/<slug>/opengraph-image` returns a 1200×630 PNG, JSON-LD validates, sitemap contains the real slug and **not** the 3 fake ones, RSS validates, FB/X debuggers render the card.
- [ ] Migration safety: confirm `platform_blog_posts` is empty in prod before the drop runs (the guarded `DO $$` block enforces this).

## Rollout / Risk
- **Interim SEO bleed**: until Task 5 ships, the 3 fake sitemap slugs + `/blog` 404 persist. If the full build will take >1 sprint, ship Task 5's `fetchBlogPosts()` removal as a standalone fast-follow first (it's independent and stops the bleed immediately).
- **Migration**: dropping `platform_blog_posts` is irreversible. The guarded empty-check + append-only discipline mitigate; take a pre-migration backup snapshot regardless.
- **Shared Discover/validation libs**: reused by the live merchant blog. Any change to `blog-featured-image-variants.ts`, `blog-discover-readiness.ts`, `validations/blog.ts`, or `blog-managed-storage-paths.ts` must be additive (new platform namespace/branch), never altering merchant behavior. Regression-test the merchant blog suites alongside.
- **Access control**: every `/api/admin/blog/*` route must call `getPlatformAdminAuth()` before any DB work; return 401 on `unauthenticated` and 403 on `forbidden`. Do not rely only on `admin/layout.tsx`; API routes are callable directly.
- **RLS**: server route checks and Zod validation are not enough. The migration must add platform-admin `blog_posts` write policies, because existing merchant-scoped policies reject `merchant_id IS NULL`.
- **Storage RLS**: the platform media namespace is not covered by the current merchant-folder media policy. Do not switch to service-role uploads to dodge this; add narrow platform-admin storage policies and verify upload/update/delete with the normal authenticated server client.
- **Render coupling**: if a future third blog surface appears, revisit Product Decision 1 and consolidate; do not pre-abstract now.

## Out of Scope (tracked, unchanged)
- Editorial content + content calendar (non-engineering).
- Multi-author roles / scheduling / revision history.
- Consolidating merchant + platform render into one component.
