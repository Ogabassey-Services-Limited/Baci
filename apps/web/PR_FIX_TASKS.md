# PR Comment Resolution - Task Tracker

## Summary
Resolve all 34 pending review comments across 4 open PRs (#171, #172, #173, #174) by delegating to parallel workstreams.

## Workstreams (for parallel delegation)

### Workstream A: PR #171 - Custom Domain Support (21 comments)
- [ ] A1: Fix `ARCHITECTURE_CUSTOM_DOMAINS.md` - markdown formatting + cache example
- [ ] A2: Fix `package.json` - dependency audit
- [ ] A3: Fix `src/app/api/branches/[id]/route.ts` - log terminal unassignment errors  
- [ ] A4: Fix `src/app/api/branches/route.ts` - return 500 on merchant lookup errors
- [ ] A5: Fix `src/app/api/paystack/virtual-terminal/route.ts` - silent failure + terminal name inconsistency
- [ ] A6: Fix `src/app/dashboard/blog/[id]/edit/page.tsx` - URL format in SEO preview
- [ ] A7: Fix `src/app/dashboard/blog/blog-client-page.tsx` - encode post slug in URL
- [ ] A8: Fix `virtual-terminal-settings.tsx` - error handling, clipboard API, keyboard a11y, hardcoded colors
- [ ] A9: Fix `BlogContentRenderer.tsx` - 2 potential issues
- [ ] A10: Fix `file-uploader.tsx` - enforce maxFiles against initialFiles
- [ ] A11: Fix `domain-cache-simple.ts` - proper LRU eviction
- [ ] A12: Fix `proxy.ts` - prevent self-redirect loops
- [ ] A13: Fix `supabase/functions/process-payouts/index.ts` - Order interface + unused variable

### Workstream B: PR #172 - Security Fixes (4 comments)
- [ ] B1: Skip `PR_REVIEW_SUMMARY.md` comment (meta-file)
- [ ] B2: Fix `src/app/api/webhooks/mycover/route.ts` - CRITICAL webhook verification
- [ ] B3: Fix `src/env.ts` - CRITICAL env validation issue
- [ ] B4: Fix `src/lib/rate-limit.test.ts` - organize imports

### Workstream C: PR #173 - Performance (9 comments)
- [ ] C1: Skip `PR_REVIEW_SUMMARY.md` comments (2 - meta-file)
- [ ] C2: Fix `src/app/api/wallet/withdraw/route.ts` - remove commented-out code
- [ ] C3: Fix `src/app/api/webhooks/mycover/route.ts` - fail-open issue (2 comments)
- [ ] C4: Fix `product-card.tsx` - dependency array + equality function
- [ ] C5: Fix `quick-view-modal.tsx` - setTimeout memory leak
- [ ] C6: Fix `src/lib/rate-limit.test.ts` - import ordering

### Workstream D: PR #174 - Accessibility (0 comments)
- [x] No pending items - only general comments from Vercel/CodeRabbit

## Verification
- [ ] Run `pnpm typecheck` across all packages
- [ ] Run `pnpm lint` to verify fixes
- [ ] Run existing tests if available
