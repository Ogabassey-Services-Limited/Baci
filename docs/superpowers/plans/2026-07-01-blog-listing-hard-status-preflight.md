# Blog Listing Hard-Status Preflight — Implementation Plan

**Goal:** Give the blog **listing** routes real HTTP statuses at the edge (like #2883 did for blog *posts*), fixing the soft-redirects deferred from PR #2884. After the #2884 "always-Suspense" fix, these `searchParams`-dependent status decisions run mid-stream and are emitted as client-side redirects instead of real `308`/`307`/`404`.

**Scope (all three deferred cases, per owner decision):**
1. `/blog?category=<known>` → real **308** to `/blog/category/<slug>` (canonicalize legacy query URLs). **High SEO value.**
2. Out-of-range `?page=N` on `/blog`, `/blog/category/<slug>`, `/blog/author/<x>` → real **307** to the last valid page. Low value (edge).
3. Known author with **no published posts** → real **404**. Low value (rare).

**Proxy approval:** Owner approved modifying `proxy.ts` (2026-07-01). #2886 (also edits proxy.ts) is open — rebase over it if it merges first.

**Branch/worktree:** `codex/blog-listing-hard-status-preflight` from `origin/main` (has #2883 + #2884).

---

## Pattern to mirror (#2883, verified on main)

- **Cached resolver** `apps/web/src/lib/cached-storefront-blog-post-status.ts` — `'use cache'` + `cacheLife('blog')` + `cacheTag`; RLS-safe via `createPublicClient` / `getMerchantSafe` / `getCachedFeatureSettings`; returns a plain `{hasError, present, redirectPath}` body.
- **Internal endpoint** `apps/web/src/app/api/internal/blog-post-status/[identifier]/route.ts` — `Authorization: Bearer <INTERNAL_API_SECRET>` via `constantTimeEqual`, zod-validated params/query, `Cache-Control: no-store`, fail-open (`{hasError:true,...}` at 200) on throw.
- **Proxy-side lib** `apps/web/src/lib/storefront-blog-post-status.ts` — `resolveInternalBaseUrl(origin)`, `AbortSignal.timeout(800)`, **fails open** to `present-or-unknown` on any error/missing secret; returns `{kind: 'missing' | 'redirect' | 'present-or-unknown'}`.
- **Proxy fn** `resolveStorefrontBlogPostHardStatus(...)` (proxy.ts ~1757) — guards (GET/HEAD only; skip RSC/prefetch/`sec-fetch-dest!=document`/draft-mode); `getStorefrontContentSegments()`; issues `NextResponse.redirect(url, 308)` or `buildHardStatusStorefrontResponse(404, ...)`.
- **Dispatch sites** (call the preflight, return early if non-null): custom-domain (~2872), subdomain (~3080), root/path-mode (~3232). Also mirror `resolveStorefrontPdpCanonicalRedirect` (proxy.ts ~1673) which already does product `?category=` → 308 with a `{response, skipHardNotFound}` shape.

Reusable data (already return `totalPages`): `getCachedBlogListing(slug,{category,page,searchQuery})` (cached-data.ts ~3159) and `getCachedBlogAuthor(slug,name,{page})` (~3301). Category helpers: `getBlogCategorySlug`, `buildBlogCategoryHref`, `findBlogCategoryLabelBySlug` (blog-category-routing.ts), `filterPublicBlogCategories` (public-blog-content-quality.ts), `resolveBlogCategoryHub` (blog-category-hub.ts).

---

## Files

**New:**
- `apps/web/src/lib/cached-storefront-blog-listing-status.ts` (+ `.test.ts`) — the cached resolver.
- `apps/web/src/lib/storefront-blog-listing-status.ts` (+ `.test.ts`) — proxy-side fetch/fail-open lib.
- `apps/web/src/app/api/internal/blog-listing-status/[identifier]/route.ts` (+ `.test.ts`) — authed endpoint.

**Modified:**
- `apps/web/src/schemas/internal-slug-set-route.ts` — add `internalBlogListingStatusQuerySchema` (`category?`, `page?`, `categorySlug?`, `authorSlug?`, `kind`).
- `apps/web/src/proxy.ts` — add `resolveStorefrontBlogListingHardStatus(...)` + wire into the 3 dispatch sites (after the post preflight, before hard-404). **Protected — show diff before applying.**

Keep each file ≤300 lines; colocated tests for every new file (repo rule).

---

## Resolver contract (`getCachedStorefrontBlogListingStatus`)

Input (discriminated by the proxy from path + query):
```ts
type Intent =
  | { kind: 'category-query'; category: string }              // /blog?category=X (page 1, no search)
  | { kind: 'listing-page'; page: number; category?: string } // /blog?page=N
  | { kind: 'category-page'; categorySlug: string; page: number }
  | { kind: 'author'; authorSlug: string; page: number };     // /blog/author/x (page default 1)
```
Output body (JSON-serializable, mirrors #2883): `{ hasError: boolean; redirectPath: string | null; notFound: boolean }`.

Logic (reuse existing cached data + category helpers; RLS-safe; fail-open on throw):
- **category-query:** load listing categories; if `category` maps to a known public clean category → `redirectPath = toSafeInternalRedirectPath('/blog/category/'+getBlogCategorySlug(label))`; else `null` (no redirect — let the route render).
- **listing-page / category-page:** compute `totalPages` from `getCachedBlogListing`; if `page > totalPages` → `redirectPath` to the last valid page (clean category route for category-page, `/blog?page=<totalPages>` or `/blog` for listing). `page < 1` → `/blog` (or clean category).
- **author:** `getCachedBlogAuthor`; if no data/zero posts → `notFound: true`; if `page > totalPages` → `redirectPath` to `/blog/author/<slug>?page=<totalPages>` (or bare for page 1).
- Always `toSafeInternalRedirectPath()` the output; only same-origin internal paths.

Endpoint returns this body at 200 (no-store); fail-open `{hasError:true, redirectPath:null, notFound:false}` on throw.

Proxy-side lib maps body → `{kind:'redirect', status:308|307, redirectPath}` | `{kind:'notFound'}` | `{kind:'noop'}`; **fails open to noop** if no secret / no base URL / timeout / `hasError`.

---

## Proxy change (the protected, show-first part)

`resolveStorefrontBlogListingHardStatus(request, pathname, hostname, userAgent, identifier, publicPathPrefix='')`:
- Same request guards as `resolveStorefrontBlogPostHardStatus`.
- `contentSegments = getStorefrontContentSegments(...)`:
  - length 1, `[0]==='blog'` → read `?category=` / `?page=` → `category-query` or `listing-page` intent.
  - length 3, `[0]==='blog' && [1]==='category'` → `category-page` intent with `?page=`.
  - length 3, `[0]==='blog' && [1]==='author'` → `author` intent with `?page=`.
  - else `null`.
- Read query from `request.nextUrl.searchParams`; ignore `search` present (skip category-query redirect when `?search=` set, matching in-route rule).
- On `redirect` → `NextResponse.redirect(clone with publicPathPrefix+path, status)`; on `notFound` → `buildHardStatusStorefrontResponse(404,...)`; else `null`.
- Wire after the post preflight at all 3 dispatch sites; return early when non-null.

**Guardrails:** GET/HEAD only; never touches non-`document` or RSC/prefetch; never touches non-`/blog` paths; fail-open everywhere so a resolver/endpoint outage never blocks rendering; identical behavior across the 3 dispatch sites.

---

## Test matrix

- **Resolver:** category-query known→redirect / unknown→null; page over/under/in-range for listing, category, author; author no-posts→notFound; fail-open on throw; RLS/publish/blog-enabled gates.
- **Endpoint:** 401 (bad/no bearer), 400 (bad params/query), 200 (each intent), fail-open 200 on resolver throw, `no-store` header.
- **Lib:** fail-open on missing secret / no base URL / timeout / `hasError` / non-2xx; correct mapping for redirect/notFound/noop.
- **Proxy:** each route shape → correct 308/307/404; `?search=` suppresses category redirect; non-blog paths untouched; RSC/prefetch/non-GET untouched; all 3 dispatch sites; fail-open when secret unset.

## Validation & ship
- `pnpm --filter @baci/web lint && typecheck`; targeted vitest for all new/changed files; then full `@baci/web` test.
- Commit per layer; open PR; note it closes the #2884 "Known limitation".
