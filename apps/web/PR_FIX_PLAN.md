# PR Comment Resolution Plan - All Open PRs

## Summary
Resolve all 34 pending review comments across 4 open PRs by organizing fixes into parallel workstreams. Each workstream addresses comments on related files, allowing independent delegation.

> [!IMPORTANT]
> **Critical Fixes First**: PRs #172 (security) and #173 (performance) contain critical issues that should be prioritized.

---

## Workstream A: PR #171 - Custom Domain Support (21 comments)

### Component: Documentation
#### [MODIFY] [ARCHITECTURE_CUSTOM_DOMAINS.md](file:///Users/mac/Baci-app/apps/web/ARCHITECTURE_CUSTOM_DOMAINS.md)
- Add missing language specifiers to fenced code blocks
- Clarify cache invalidation example (remove conflicting `invalidate: true` parameter)

---

### Component: Dependencies
#### [MODIFY] [package.json](file:///Users/mac/Baci-app/apps/web/package.json)
- Audit dependency for potential issue flagged by CodeRabbit

#### [MODIFY] [package.json](file:///Users/mac/Baci-app/package.json) (root)
- Audit dependency issue in root package.json

---

### Component: Branch API
#### [MODIFY] [route.ts](file:///Users/mac/Baci-app/apps/web/src/app/api/branches/[id]/route.ts)
- Log errors from virtual terminal unassignment (currently silently ignored)

#### [MODIFY] [route.ts](file:///Users/mac/Baci-app/apps/web/src/app/api/branches/route.ts)
- Return 500 on merchant lookup errors (don't map DB errors to 404)
- Add explicit error handling: `{ data, error }` pattern

---

### Component: Virtual Terminal API
#### [MODIFY] [route.ts](file:///Users/mac/Baci-app/apps/web/src/app/api/paystack/virtual-terminal/route.ts)
- Fix silent failure after Paystack terminal creation
- Make terminal name consistent between response and database

---

### Component: Blog Dashboard
#### [MODIFY] [page.tsx](file:///Users/mac/Baci-app/apps/web/src/app/dashboard/blog/[id]/edit/page.tsx)
- Fix inconsistent URL format in SEO preview (add leading slash)

#### [MODIFY] [blog-client-page.tsx](file:///Users/mac/Baci-app/apps/web/src/app/dashboard/blog/blog-client-page.tsx)
- Encode post slug in custom domain URL (`encodeURIComponent`)

---

### Component: Virtual Terminal Settings UI
#### [MODIFY] [virtual-terminal-settings.tsx](file:///Users/mac/Baci-app/apps/web/src/app/dashboard/settings/payments/components/virtual-terminal-settings.tsx)
- Add user feedback on data fetch failures (show toast/alert)
- Add error handling for clipboard API
- Make copy icon keyboard accessible (change from icon to button)
- Replace hardcoded blue colors with theme-aware classes

---

### Component: Blog Renderer
#### [MODIFY] [BlogContentRenderer.tsx](file:///Users/mac/Baci-app/apps/web/src/components/blog/renderer/BlogContentRenderer.tsx)
- 2 potential issues flagged (needs deeper investigation via linked comments)

---

### Component: File Uploader
#### [MODIFY] [file-uploader.tsx](file:///Users/mac/Baci-app/apps/web/src/components/ui/file-uploader.tsx)
- Enforce `maxFiles` constraint against `initialFiles` when accepting drops

---

### Component: Domain Cache
#### [MODIFY] [domain-cache-simple.ts](file:///Users/mac/Baci-app/apps/web/src/lib/domain-cache-simple.ts)
- Fix LRU eviction (currently not truly LRU due to Map iteration order)

---

### Component: Proxy
#### [MODIFY] [proxy.ts](file:///Users/mac/Baci-app/apps/web/src/proxy.ts)
- Prevent self-redirect loops when target domain equals source domain

---

### Component: Payout Functions
#### [MODIFY] [index.ts](file:///Users/mac/Baci-app/apps/web/supabase/functions/process-payouts/index.ts)
- Sync Order interface with actual database query columns
- Remove unused `_transferReference` variable

---

## Workstream B: PR #172 - Security Fixes (4 comments)

> [!CAUTION]
> This workstream contains **2 CRITICAL** security issues.

### Component: Webhook Security
#### [MODIFY] [route.ts](file:///Users/mac/Baci-app/apps/web/src/app/api/webhooks/mycover/route.ts)
- 🔴 **CRITICAL**: Fix webhook signature verification vulnerability

### Component: Environment Validation
#### [MODIFY] [env.ts](file:///Users/mac/Baci-app/apps/web/src/env.ts)
- 🔴 **CRITICAL**: Fix environment variable validation issue

### Component: Test Imports
#### [MODIFY] [rate-limit.test.ts](file:///Users/mac/Baci-app/apps/web/src/lib/rate-limit.test.ts)
- Organize imports to satisfy CI quality gate

---

## Workstream C: PR #173 - Performance (9 comments)

### Component: Wallet API
#### [MODIFY] [route.ts](file:///Users/mac/Baci-app/apps/web/src/app/api/wallet/withdraw/route.ts)
- Remove large commented-out withdrawal flow code

### Component: Webhook Security (shared with B)
#### [MODIFY] [route.ts](file:///Users/mac/Baci-app/apps/web/src/app/api/webhooks/mycover/route.ts)
- 🟠 **MAJOR**: Fix fail-open behavior when secret is missing in production

### Component: Storefront Performance
#### [MODIFY] [product-card.tsx](file:///Users/mac/Baci-app/apps/web/src/components/storefront/product-card.tsx)
- Narrow `productCategory` dependency in callback
- 🟠 **MAJOR**: Fix incomplete custom equality function (may cause stale renders)

#### [MODIFY] [quick-view-modal.tsx](file:///Users/mac/Baci-app/apps/web/src/components/storefront/quick-view-modal.tsx)
- Clear setTimeout on unmount to prevent memory leak

### Component: Test Imports (shared with B)
#### [MODIFY] [rate-limit.test.ts](file:///Users/mac/Baci-app/apps/web/src/lib/rate-limit.test.ts)
- Fix import ordering to satisfy CI

---

## Workstream D: PR #174 - Accessibility (0 code comments)

✅ **No pending action items** - Only general summary comments from Vercel/CodeRabbit.

---

## Verification Plan

### Automated Verification
```bash
# Run from /Users/mac/Baci-app
pnpm typecheck        # TypeScript validation
pnpm lint             # Linting (includes import order checks)
pnpm test             # Run existing tests
```

### CI Quality Gate
- All fixes will be validated by the existing GitHub Actions CI workflow
- The PR #172 and #173 currently show CI warnings that these fixes should resolve

### Manual Verification
- **Security fixes (B)**: Review the webhook route to confirm signature verification logic
- **Performance fixes (C)**: Confirm React component memoization is correct
- **After pushing**: Monitor CodeRabbit for re-review and comment resolution

---

## Execution Strategy
Since the user wants parallel delegation, the work can be split as:

| Agent | Workstream | Focus | Priority |
|-------|------------|-------|----------|
| 1 | B + C (shared files) | Security + Performance | 🔴 HIGH |
| 2 | A (API routes) | Branch, Virtual Terminal, Proxy | 🟡 MEDIUM |
| 3 | A (UI components) | Blog, File Uploader, Settings | 🟡 MEDIUM |
| 4 | A (Docs + Functions) | Architecture docs, Payout functions | 🔵 LOW |

Files with shared comments across PRs:
- `src/app/api/webhooks/mycover/route.ts` (PR #172 + #173)
- `src/lib/rate-limit.test.ts` (PR #172 + #173)
