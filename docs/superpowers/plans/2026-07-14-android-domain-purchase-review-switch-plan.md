# Android Domain Purchase Review Switch Implementation Plan

> **For Codex:** Use `superpowers:executing-plans` and follow each task test-first.

**Goal:** Hide domain purchasing throughout the Android mobile-admin app behind one boolean set to `false`, while preserving iOS purchasing and domain connection/management.

**Architecture:** Add a focused availability helper whose Android branch is controlled by a single constant. All three Android entry points consume that helper: the choice screen omits purchase, the empty state omits purchase, and the direct buy route redirects to domain connection before purchase hooks mount. Existing web payment and iOS behavior remain unchanged.

**Tech Stack:** Expo Router, React Native, TypeScript, Vitest, React Native Testing Library.

---

### Task 1: Add the central Android availability switch

**Files:**
- Create: `apps/mobile-admin/config/domain-purchase-availability.ts`
- Create: `apps/mobile-admin/config/domain-purchase-availability.test.ts`

1. Add a failing test that expects domain purchasing to be disabled on Android and enabled on iOS and web.
2. Run the focused test and confirm it fails because the availability module does not exist.
3. Add `ANDROID_DOMAIN_PURCHASE_ENABLED = false` and a typed `isDomainPurchaseEnabled(platform)` helper using `selectRuntimePlatform`, avoiding new direct platform API usage.
4. Run the focused test and platform-branch drift check; confirm both pass with the canonical allowlist unchanged.

### Task 2: Hide the purchase choice on Android

**Files:**
- Modify: `apps/mobile-admin/app/(admin)/domains/add.test.tsx`
- Modify: `apps/mobile-admin/app/(admin)/domains/add.tsx`

1. Mock the availability helper in the existing screen tests.
2. Add a failing Android test that expects the purchase card and purchase-oriented copy to be absent while the connect card remains usable.
3. Run the focused test and confirm it fails against the current unconditional purchase card.
4. Use the helper to conditionally render the purchase card and Android-safe explanatory copy.
5. Run the focused test and confirm all Android and iOS cases pass.

### Task 3: Hide the empty-state purchase action on Android

**Files:**
- Create: `apps/mobile-admin/components/domains/DomainEmptyState.test.tsx`
- Modify: `apps/mobile-admin/components/domains/DomainEmptyState.tsx`
- Modify: `apps/mobile-admin/app/(admin)/domains/index.test.tsx`
- Modify: `apps/mobile-admin/app/(admin)/domains/index.tsx`

1. Add a failing component test showing that omitting the optional buy callback removes the buy button but keeps connect.
2. Run the focused component test and confirm the current required/unconditional buy action fails it.
3. Make the buy callback optional and render its action only when supplied.
4. Update the index test mock to model the optional callback, mock availability, and add a failing Android empty-state test.
5. Pass no buy callback from the domains index when purchasing is unavailable.
6. Run both focused suites and confirm they pass.

### Task 4: Guard direct Android navigation to the buy route

**Files:**
- Modify: `apps/mobile-admin/app/(admin)/domains/buy.test.tsx`
- Modify: `apps/mobile-admin/app/(admin)/domains/buy.tsx`

1. Mock the availability helper and Expo Router `Redirect` in the existing route tests.
2. Add a failing Android test expecting a redirect to `/domains/connect`, no purchase UI, and no purchase session/search side effects.
3. Run the focused test and confirm it fails against the current unguarded screen.
4. Keep the existing purchase screen as an inner component and add a default route wrapper that returns `Redirect` when purchasing is unavailable, before purchase hooks mount.
5. Run the focused suite and confirm Android is guarded while existing iOS purchase tests remain green.

### Task 5: Verify, review, and publish

**Files:** All changed files.

1. Run all affected mobile-admin domain tests.
2. Run `pnpm --filter baci-mobile-admin test`, `pnpm turbo lint`, and `pnpm turbo typecheck`.
3. Run the platform-branch drift check and ensure modified source files remain within the narrow approved scope.
4. Run CodeRabbit against uncommitted changes and fix any critical or high-severity findings.
5. Review the final diff, commit it, push `codex/android-hide-domain-purchase`, and create a ready PR against `main` with verification results and the one-click re-enable instruction.
