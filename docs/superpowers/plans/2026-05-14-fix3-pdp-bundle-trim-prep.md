# Fix 3 — PDP JS Bundle Trim (Prep Handoff)

> **Status: prep doc, not a skill-compliant plan.** Captures the diagnostic data, library-presence findings, and a step-by-step methodology so a future agent can do the per-file mapping and write the actual TDD-task plan. Picking this up cleanly should take 1-2 hours of focused investigation before any code changes.

## Context

PR #1634 fixed PDP desktop LCP (2769 → 1357 ms ✅). After deploy, the mobile PDP became measurable for the first time (was timing out in PSI). Mobile LCP came in at **4824 ms** — still poor, but the LCP discovery checks all pass (`fetchpriority=high` applied, eagerly loaded, request discoverable). The bottleneck is **main-thread cost during the FCP→LCP window** from JS/CSS bundle bloat — not a missing preload.

This is the original audit's [Fix 3](2026-05-13-storefront-lcp-interventions.md) ("PDP JS bundle audit + tree-shake"), now with concrete starting evidence.

See also: [docs/audits/2026-05-13-storefront-lcp-baseline.md#mobile-pdp-diagnostic-post-1634](../../audits/2026-05-13-storefront-lcp-baseline.md).

---

## Diagnostic findings

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

Counted by `grep -l <library>` against `.next/static/chunks/*.js` on a `pnpm --filter @baci/web analyze` build off `origin/main` at `0d329a52`:

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
cd /Users/mac/Baci-app
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
1. **`moment` → `date-fns` migration**: well-known industry pattern, ~70 KiB savings. Mechanical search-and-replace mostly.
2. **`puck` / `tiptap` / `prosemirror` dynamic-import**: the builder's editor stack — should be loaded only when builder mounts. ~100+ KiB savings combined.
3. **`three` audit**: 18 chunks is suspicious; either it's incorrectly aliased (some other package depends on `three` transitively) or builder/3D code is being imported eagerly. Big potential savings (~600 KiB unminified).
4. **`recharts` dynamic-import on dashboard pages**: probably already done; verify and dynamic-import any remaining direct imports.
5. **`lodash` named imports**: convert `import _ from 'lodash'` → `import { specificFn } from 'lodash-es'` (or even better, native ES equivalents).

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

A worktree was left at `/Users/mac/Baci-app/.worktrees/fix3-bundle-analyze/` with a built `.next/` containing the production chunks I inspected. Either reuse for further investigation OR remove with:

```bash
cd /Users/mac/Baci-app
git worktree remove --force .worktrees/fix3-bundle-analyze
git branch -D chore/fix3-bundle-analyze
```

When the actual Fix 3 plan gets written (skill-compliant TDD tasks per intervention), reference back to this prep doc for the "Why" / "Evidence" context.
