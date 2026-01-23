# All Open PRs - Review Summary

**Generated:** 2026-01-23T11:44:30.235Z

## 📊 Global Summary

| Metric | Count |
|--------|-------|
| **Open PRs** | 4 |
| **Total Threads** | 34 |
| ✅ Resolved | 0 |
| 🔴 Pending | 34 |
| 💬 General Comments | 8 |
| **Completion** | **0.0%** |

## 📋 PR Overview

| PR | Title | Pending | Resolved | Total |
|----|-------|---------|----------|-------|
| [#174](https://github.com/ogabasseyy/Baci/pull/174) | a11y(storefront): improve accessibility across sto... | 0 | 0 | 0 |
| [#173](https://github.com/ogabasseyy/Baci/pull/173) | perf(storefront): optimize product grid rendering ... | 9 | 0 | 9 |
| [#172](https://github.com/ogabasseyy/Baci/pull/172) | feat(security): consolidate critical security fixe... | 4 | 0 | 4 |
| [#171](https://github.com/ogabasseyy/Baci/pull/171) | feat(blog): implement custom domain support with S... | 21 | 0 | 21 |

---

# PR #174: a11y(storefront): improve accessibility across storefront components

**Progress:** 0/0 (100.0%) | 💬 2 comments

## 🎉 No Pending Items!

<details>
<summary>💬 <b>2</b> General Comments</summary>

> **vercel**: [vc]: #/TzIhanhCKifzoSoycuoyqW8m2UWoYFtgH8OORU7qeA=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJiYWNpIiwicHJvamVjdElkIj

> **coderabbitai**: <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- This is an auto-generated comment: review in progress by coderabbit.ai -->

</details>

---

# PR #173: perf(storefront): optimize product grid rendering with React 19 patterns

**Progress:** 0/9 (0.0%) | 💬 2 comments

## 🔴 Pending Action Items

### 📄 `apps/web/PR_REVIEW_SUMMARY.md` (2)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _🧹 Nitpick_ \| _🔵 Trivial_  **Optional: Add language specifiers to code blocks for better renderin... | [View](https://github.com/ogabasseyy/Baci/pull/173#discussion_r2720847204) |
| **coderabbitai** | _⚠️ Potential issue_ \| _🟠 Major_  **Fix incomplete dependency array in useCallback example.**  The... | [View](https://github.com/ogabasseyy/Baci/pull/173#discussion_r2720847211) |

### 📄 `apps/web/src/app/api/wallet/withdraw/route.ts` (1)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _🧹 Nitpick_ \| _🔵 Trivial_  **Prefer removing the commented-out withdrawal flow.**   Keeping large... | [View](https://github.com/ogabasseyy/Baci/pull/173#discussion_r2720847213) |

### 📄 `apps/web/src/app/api/webhooks/mycover/route.ts` (2)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _⚠️ Potential issue_ \| _🟡 Minor_  <details> <summary>🧩 Analysis chain</summary>  🏁 Script execut... | [View](https://github.com/ogabasseyy/Baci/pull/173#discussion_r2720847215) |
| **coderabbitai** | _⚠️ Potential issue_ \| _🟠 Major_  **Fail‑open in production if secret missing.**   In production, ... | [View](https://github.com/ogabasseyy/Baci/pull/173#discussion_r2720847275) |

### 📄 `apps/web/src/components/storefront/product-card.tsx` (2)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _🧹 Nitpick_ \| _🔵 Trivial_  **Consider narrowing `productCategory` dependency.**  The dependency a... | [View](https://github.com/ogabasseyy/Baci/pull/173#discussion_r2720847282) |
| **coderabbitai** | _⚠️ Potential issue_ \| _🟠 Major_  **Incomplete custom equality function may cause stale renders.**... | [View](https://github.com/ogabasseyy/Baci/pull/173#discussion_r2720847287) |

### 📄 `apps/web/src/components/storefront/quick-view-modal.tsx` (1)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _⚠️ Potential issue_ \| _🟡 Minor_  **Potential memory leak: setTimeout not cleared on unmount.**  T... | [View](https://github.com/ogabasseyy/Baci/pull/173#discussion_r2720847290) |

### 📄 `apps/web/src/lib/rate-limit.test.ts` (1)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _⚠️ Potential issue_ \| _🟡 Minor_  **Fix import ordering to satisfy CI.**   The quality gate flags ... | [View](https://github.com/ogabasseyy/Baci/pull/173#discussion_r2720847294) |

<details>
<summary>💬 <b>2</b> General Comments</summary>

> **vercel**: [vc]: #f580999/3a3+rmMMg89ClrTc4Z7wTGgpdu+sRPHs2eg=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJiYWNpIiwicHJvamVjdElkIj

> **coderabbitai**: <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Wal

</details>

---

# PR #172: feat(security): consolidate critical security fixes (XSS, Access Control, Webhook Verification)

**Progress:** 0/4 (0.0%) | 💬 2 comments

## 🔴 Pending Action Items

### 📄 `apps/web/PR_REVIEW_SUMMARY.md` (1)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _⚠️ Potential issue_ \| _🟡 Minor_  <details> <summary>🧩 Analysis chain</summary>  🏁 Script execut... | [View](https://github.com/ogabasseyy/Baci/pull/172#discussion_r2720821607) |

### 📄 `apps/web/src/app/api/webhooks/mycover/route.ts` (1)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _⚠️ Potential issue_ \| _🔴 Critical_  <details> <summary>🧩 Analysis chain</summary>  🏁 Script exe... | [View](https://github.com/ogabasseyy/Baci/pull/172#discussion_r2720821616) |

### 📄 `apps/web/src/env.ts` (1)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _⚠️ Potential issue_ \| _🔴 Critical_  <details> <summary>🧩 Analysis chain</summary>  🏁 Script exe... | [View](https://github.com/ogabasseyy/Baci/pull/172#discussion_r2720821620) |

### 📄 `apps/web/src/lib/rate-limit.test.ts` (1)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _⚠️ Potential issue_ \| _🟡 Minor_  **Fix CI warning: organize imports.**  CI reports “Organize Impo... | [View](https://github.com/ogabasseyy/Baci/pull/172#discussion_r2720821623) |

<details>
<summary>💬 <b>2</b> General Comments</summary>

> **vercel**: [vc]: #8TxiCC3CKtOhWrygYUBJQ5ahxfnIZkPBPONuns7g1Fk=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJiYWNpIiwicHJvamVjdElkIj

> **coderabbitai**: <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Wal

</details>

---

# PR #171: feat(blog): implement custom domain support with SEO redirects and viewport fix

**Progress:** 0/21 (0.0%) | 💬 2 comments

## 🔴 Pending Action Items

### 📄 `apps/web/ARCHITECTURE_CUSTOM_DOMAINS.md` (2)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _🧹 Nitpick_ \| _🔵 Trivial_  **Minor markdown formatting issues.**  Static analysis flagged missing... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763273) |
| **coderabbitai** | _🧹 Nitpick_ \| _🔵 Trivial_  **Clarify cache invalidation example.**  The example shows both `inval... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763279) |

### 📄 `apps/web/package.json` (1)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _⚠️ Potential issue_ \| _🟡 Minor_  <details> <summary>🧩 Analysis chain</summary>  🌐 Web query:  `... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763283) |

### 📄 `apps/web/src/app/api/branches/[id]/route.ts` (1)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _🧹 Nitpick_ \| _🔵 Trivial_  **Error from virtual terminal unassignment is silently ignored.**  Sim... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763288) |

### 📄 `apps/web/src/app/api/branches/route.ts` (1)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _⚠️ Potential issue_ \| _🟠 Major_  **Return 500 on merchant lookup errors (don’t map them to 404).*... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763291) |

### 📄 `apps/web/src/app/api/paystack/virtual-terminal/route.ts` (2)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _⚠️ Potential issue_ \| _🟠 Major_  **Silent failure after Paystack terminal creation may cause data... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763294) |
| **coderabbitai** | _⚠️ Potential issue_ \| _🟡 Minor_  **Inconsistent terminal name in response vs database.**  The ter... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763312) |

### 📄 `apps/web/src/app/dashboard/blog/[id]/edit/page.tsx` (1)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _🧹 Nitpick_ \| _🔵 Trivial_  **Inconsistent URL format in SEO preview.**  The custom domain path sh... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763321) |

### 📄 `apps/web/src/app/dashboard/blog/blog-client-page.tsx` (1)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _🧹 Nitpick_ \| _🔵 Trivial_  **Consider encoding the post slug in the custom domain URL.**  The `po... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763328) |

### 📄 `apps/web/src/app/dashboard/settings/payments/components/virtual-terminal-settings.tsx` (4)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _🧹 Nitpick_ \| _🔵 Trivial_  **Silent failure on data fetch may confuse users.**  When API calls fa... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763334) |
| **coderabbitai** | _🧹 Nitpick_ \| _🔵 Trivial_  **Add error handling for clipboard API.**  `navigator.clipboard.writeT... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763339) |
| **coderabbitai** | _⚠️ Potential issue_ \| _🟡 Minor_  **Copy icon is not keyboard accessible.**  The `<Copy>` icon use... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763347) |
| **coderabbitai** | _🧹 Nitpick_ \| _🔵 Trivial_  **Hardcoded blue colors may not adapt to dark mode.**  The pro-tip sec... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763352) |

### 📄 `apps/web/src/components/blog/renderer/BlogContentRenderer.tsx` (2)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _⚠️ Potential issue_ \| _🟡 Minor_  <details> <summary>🧩 Analysis chain</summary>  🏁 Script execut... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763359) |
| **coderabbitai** | _⚠️ Potential issue_ \| _🟠 Major_  <details> <summary>🧩 Analysis chain</summary>  🏁 Script execut... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763361) |

### 📄 `apps/web/src/components/ui/file-uploader.tsx` (1)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _⚠️ Potential issue_ \| _🟠 Major_  **Enforce maxFiles against initialFiles when accepting drops**  ... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763366) |

### 📄 `apps/web/src/lib/domain-cache-simple.ts` (1)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _🧹 Nitpick_ \| _🔵 Trivial_  **LRU eviction isn’t actually LRU right now.**   Map iteration order o... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763368) |

### 📄 `apps/web/src/proxy.ts` (1)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _⚠️ Potential issue_ \| _🟠 Major_  **Prevent self-redirect loops when the target domain equals the ... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763373) |

### 📄 `apps/web/supabase/functions/process-payouts/index.ts` (2)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _🧹 Nitpick_ \| _🔵 Trivial_  **Order interface may not match the actual database query.**  The `Ord... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763375) |
| **coderabbitai** | _🧹 Nitpick_ \| _🔵 Trivial_  **Remove unused variable.**  `_transferReference` is assigned but neve... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763384) |

### 📄 `package.json` (1)

| Author | Comment | Link |
|--------|---------|------|
| **coderabbitai** | _⚠️ Potential issue_ \| _🟡 Minor_  <details> <summary>🧩 Analysis chain</summary>  🌐 Web query:  `... | [View](https://github.com/ogabasseyy/Baci/pull/171#discussion_r2720763392) |

<details>
<summary>💬 <b>2</b> General Comments</summary>

> **vercel**: [vc]: #WAwQMoREqLqcZs0h5YyRGBjGKd2D7W+AW49cKoEP1W0=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJiYWNpIiwicHJvamVjdElkIj

> **coderabbitai**: <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Wal

</details>

---


**Overall Progress:** 0/34 (0.0%) Threads Resolved
