# Fix 3 — PDP JS Bundle Trim (Prep Handoff)

> **Status: investigation completed for the first intervention.** This doc started as a prep handoff. Stage 1-4 investigation on 2026-05-14 found that the first high-confidence PDP bundle target is not `moment` / `three`; it is the generic product-detail client graph leaking Framer Motion into the OgaBassey PDP first-load bundle. The implementation plan is [2026-05-14-fix3-ogabassey-pdp-client-graph-split.md](2026-05-14-fix3-ogabassey-pdp-client-graph-split.md).

## Context

PR #1634 fixed PDP desktop LCP (2769 → 1357 ms ✅). After deploy, the mobile PDP became measurable for the first time (was timing out in PSI). Mobile LCP came in at **4824 ms** — still poor, but the LCP discovery checks all pass (`fetchpriority=high` applied, eagerly loaded, request discoverable). The bottleneck is **main-thread cost during the FCP→LCP window** from JS/CSS bundle bloat — not a missing preload.

This is the original audit's [Fix 3](2026-05-13-storefront-lcp-interventions.md) ("PDP JS bundle audit + tree-shake"), now with concrete starting evidence.

See also: [docs/audits/2026-05-13-storefront-lcp-baseline.md#mobile-pdp-diagnostic-post-1634](../../audits/2026-05-13-storefront-lcp-baseline.md).

---

## Diagnostic findings

### Stage 1-4 investigation result (2026-05-14)

Current-code investigation used the local `.worktrees/fix3-bundle-analyze` worktree at `origin/main` (`0d329a52`) with its existing `apps/web/.next/` production build, plus a live fetch of the canonical PDP URL.

Important corrections to the earlier library-presence table:

| Candidate | Import-site result | PDP route result | Decision |
|---|---:|---|---|
| `moment` | 0 direct app imports; `pnpm --filter @baci/web why moment` returns no owner | Local chunk hits were ordinary words like `momentary` inside syntax/highlight dictionaries, not Moment.js | Skip for Fix 3 PR 1 |
| `three` | 0 direct app imports; `pnpm --filter @baci/web why three` returns no owner | Local chunk hits were ordinary words like `three` inside syntax/highlight dictionaries, not Three.js | Skip for Fix 3 PR 1 |
| `lodash` | 0 direct app imports; package appears in lockfile via non-PDP tooling/mobile deps | PDP first-load route stats and live PDP chunks did not show lodash signatures | Skip for Fix 3 PR 1 |
| `recharts` | 5 direct import sites: dashboard/admin analytics and `components/ui/chart.tsx` | Not present in PDP first-load route stats | Skip for Fix 3 PR 1 |
| Puck | Runtime imports in builder/onboarding and `components/storefront/puck-storefront.tsx`; type-only imports elsewhere | Not present in PDP first-load route stats | Skip for Fix 3 PR 1 |
| Tiptap / ProseMirror | Blog/editor/dashboard product import sites | Not present in PDP first-load route stats | Skip for Fix 3 PR 1 |
| Framer Motion | Direct imports include `components/ui/animated-icons.tsx`, storefront blocks, analytics, and dashboard | Present in PDP first-load route stats and live PDP chunk `06lahl58v69w8.js` via `createMotionProxy` / `MotionConfigContext` | **First intervention** |

Leak path:

```text
apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/page.tsx
  static import ProductDetailClient
apps/web/src/app/(storefront)/[slug]/(catalog)/products/[productSlug]/product-detail-client.tsx
  import StickyAddToCart
apps/web/src/components/storefront/sticky-add-to-cart.tsx
  import QuantityButton
apps/web/src/components/ui/animated-icons.tsx
  import framer-motion
```

The OgaBassey branch does not render `ProductDetailClient`, `StickyAddToCart`, or `animated-icons`, but the shared product route imports `ProductDetailClient` at module scope before it knows `template_id`. Next.js therefore includes the generic client graph in the first-load route bundle.

Evidence:

```text
route-bundle-stats: /[slug]/[category]/[productSlug]
firstLoadUncompressedJsBytes: 1,679,122
framer chunks: 0uwk4x99eg-k..js (50,599 bytes), 0osky5~p0fo6g.js (159,955 bytes)
generic-client markers: QuantityButton, AnimatedIcon, useRecentlyViewed
live PDP top unused chunk: 06lahl58v69w8.js contains Framer Motion signatures
```

The first PR should split the default/generic product client graph behind the non-OgaBassey branch so OgaBassey PDP first-load chunks no longer contain Framer Motion or generic product-client markers.

### PSI unused-code waste (mobile PDP, post-#1634, 2026-05-13)

| Asset | Size | Unused | Notes |
|---|---:|---:|---|
| `static/chunks/06lahl58v69w8.js` | 50.0 KiB | **99%** | Entire chunk dead on PDP — top target |
| `static/chunks/0lh1n0u.woa3u.js` | 50.0 KiB | 78% | |
| `static/chunks/0gz45~85tkqo~.js` | 35.2 KiB | 52% | |
| `static/chunks/0ifcm50gd35av.js` | 21.3 KiB | 29% | Contains a 167 ms long task |
| `static/chunks/0r9209x4w9n3v.css` | 37.6 KiB | **94%** | Near-totally-unused CSS |

**Total: 156 KiB unused JS + 38 KiB unused CSS = ~900 ms estimated main-thread savings.**

### Heavy library presence (local production build, 2026-05-14)

Original broad count by `grep -l <library>` against `.next/static/chunks/*.js` on a `pnpm --filter @baci/web analyze` build off `origin/main` at `0d329a52`. Treat this as **global build signal only**, not PDP attribution. The Stage 1-4 investigation above supersedes it for first-PR target selection.

| Library | Chunks | Likely source | PDP need? |
|---|---:|---|---|
| `moment` | 10 | Legacy date handling | ❌ swap to `date-fns` (already 6 chunks) |
| `lodash` | 5 | Builder/admin probably | ❌ tree-shake to named imports or native ES |
| `three` (Three.js) | 18 | Builder 3D preview | ❌ definitely not on storefront PDP |
| `recharts` | 7 | Dashboard analytics | ❌ shouldn't be on PDP |
| `puck` (Puck editor) | 9 | Builder visual editor | ❌ shouldn't be on storefront/PDP |
| `tiptap` + `prosemirror` | 7 + 3 | Rich text editor (blog/builder) | ❌ not on PDP |
| `@radix-ui` | 10 | UI primitives | ✅ expected, keep |
| `date-fns` | 6 | Various | ✅ keep |
| `googletagmanager` | 6 | Analytics | ⚠️ verify it's deferred |

Top 5 chunks by raw size:

| Chunk | Size | Library hint |
|---|---:|---|
| `12ctbyflgpbrq.js` | 762 KiB | contains `moment` |
| `0ddi-0dur1i5n.js` | 721 KiB | contains `lodash` |
| `0spu57t2py-xt.js` | 612 KiB | (unknown — top investigation target) |
| `16yu192qqh-.-.js` | 608 KiB | (unknown) |
| `0kcg.mdmnmltr.js` | 595 KiB | (unknown) |

> **Note on chunk-hash matching:** the local build's chunk hashes don't match production's because env vars affect Turbopack's output hashing. Production PSI chunks (e.g. `06lahl58v69w8.js`) and local build chunks (e.g. `12ctbyflgpbrq.js`) are different physical files — same code, different hashes. Identify libraries by content (`grep`), not by hash.

> **Note on `@next/bundle-analyzer`:** the plugin is webpack-only and silently no-ops under Turbopack (Next.js 16's default build engine). The reports it normally writes to `.next/analyze/{client,server,edge}.html` are NOT produced. Pivot to direct chunk-content inspection or run with `NEXT_DISABLE_TURBOPACK=true` (untested — may require additional config).

---

## Methodology (for the next agent)

Two-stage investigation: **map library → source file**, then **classify entry point** (storefront-PDP-needed vs builder/dashboard-only).

### Stage 1 — Map each heavy library to its import sites

For each library in the table above flagged ❌:

```bash
# From your local Baci repository root:
grep -rln "from ['\"]moment['\"]\|from ['\"]moment/" apps/web/src 2>/dev/null
grep -rln "from ['\"]lodash['\"]\|from ['\"]lodash/" apps/web/src 2>/dev/null
grep -rln "from ['\"]three['\"]\|from ['\"]three/" apps/web/src 2>/dev/null
grep -rln "from ['\"]recharts['\"]" apps/web/src 2>/dev/null
grep -rln "from ['\"]@measured/puck\|from ['\"]@puck" apps/web/src 2>/dev/null
grep -rln "from ['\"]@tiptap" apps/web/src 2>/dev/null
grep -rln "from ['\"]prosemirror" apps/web/src 2>/dev/null
```

Record the file count + sample paths per library.

### Stage 2 — Classify each importer

For each file from Stage 1, determine its route placement:
- Is it under `apps/web/src/app/(storefront)/` or `apps/web/src/components/storefront/`? → it ships to PDP (or could leak via shared dependency)
- Is it under `apps/web/src/app/dashboard/`, `apps/web/src/app/builder/`, `apps/web/src/app/admin/`, or `apps/web/src/components/builder/` / `dashboard/` / `admin/`? → should NOT be on storefront — investigate why it's in the storefront chunk

### Stage 3 — Trace leak paths

If a builder/dashboard file's heavy library is reaching the PDP, trace HOW. Common patterns:
1. Storefront imports a shared utility that transitively imports the builder code (the worst kind — fix by extracting the utility to a shared package or breaking the import chain)
2. A barrel `index.ts` re-exports everything from a directory containing builder code (fix: switch consumers to deep imports)
3. A component is imported at module level when it should be `dynamic(() => import(...))` (fix: convert to dynamic import)
4. SSR-only code accidentally bundled into client (fix: `'server-only'` import or move to a server file)

### Stage 4 — Pick interventions

Order targets by `(savings × confidence) / engineering-cost`. Likely order based on current evidence:
1. **OgaBassey PDP client graph split**: move the generic `ProductDetailClient` behind the default-template branch so `StickyAddToCart` / `animated-icons` / Framer Motion are not first-load code for OgaBassey PDP. This is the selected first intervention.
2. **Dashboard/editor stack verification**: Puck/Tiptap/ProseMirror/Recharts are not currently PDP first-load code, so do not spend the first PR here. Revisit only if later PSI runs identify them in PDP network activity.
3. **CSS unused-rules pass**: `0r9209x4w9n3v.css` is still 94% unused in PSI. Handle as a separate CSS diagnostic after the JS graph split, because the intervention is likely Tailwind/CSS scoping rather than library import cleanup.
4. **`lodash` package-owner audit**: current PDP evidence does not justify a first PR, but a broader dashboard/admin bundle pass can still inspect lodash consumers later.

---

## Acceptance criteria (for the actual Fix 3 PR, when it's written)

After the bundle trim PR lands:
- Mobile PDP LCP < **3500 ms** (down from 4824 ms post-#1634)
- PSI `unused-javascript` audit reports < **80 KiB** (down from 156 KiB)
- PSI `unused-css-rules` audit reports < **20 KiB** (down from 38 KiB)
- TBT on PDP desktop drops below **300 ms** (currently 445 ms)
- No visual or interaction regression on PDP (cart, image gallery, reviews, add-to-cart, comparison, BNPL flow)

---

## Risks

1. **Dynamic-importing a component that's expected synchronously**. The hydration boundary may flash empty content. Test on slow connections.
2. **Removing a `moment` import** without verifying all callers can use `date-fns`'s API. Date arithmetic differs subtly (`moment().add(1, 'month')` vs `date-fns/addMonths`).
3. **Three.js is sometimes a transitive dep** (e.g. via `@react-three/...` or some visualization lib). Removing it requires removing the consumer.
4. **PSI variance**: a single PSI run can drift ±15% on mobile. Verify improvements with 3-5 runs averaged.

---

## Inputs available to the next agent

- This doc
- [docs/audits/2026-05-13-storefront-lcp-baseline.md](../../audits/2026-05-13-storefront-lcp-baseline.md) — full audit including pre-#1634 baseline
- The Stop hook env var `QUALITY_GATE_PROJECT_DIR_ONLY=1` is in `~/.zshrc` so multi-worktree sessions don't trip
- `PAGESPEED_INSIGHTS_API_KEY` for PSI runs (ask user — was previously provided inline)
- The analyze build worked locally with `SUPABASE_JWT_SECRET="<dummy>"` inline + `apps/web/.env.production` copied from `apps/web/.env.vercel.production`. Reproduce that env setup to re-run analysis.

---

## Cleanup notes (for the agent that picks this up)

A worktree was left at `.worktrees/fix3-bundle-analyze/` with a built `.next/` containing the production chunks I inspected. Either reuse for further investigation OR remove with:

```bash
# From your local Baci repository root:
git worktree remove --force .worktrees/fix3-bundle-analyze
git branch -D chore/fix3-bundle-analyze
```

When the actual Fix 3 plan gets written (skill-compliant TDD tasks per intervention), reference back to this prep doc for the "Why" / "Evidence" context.
