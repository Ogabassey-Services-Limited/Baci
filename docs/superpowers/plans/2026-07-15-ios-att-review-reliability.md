# iOS ATT Review Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the native App Tracking Transparency prompt reliably reachable in the Ogabassey storefront and document the exact review path during automated App Store submission.

**Architecture:** Replace the Home-screen timer with one root-lifecycle hook enabled after the startup UI is visible. The hook owns the ATT status check, active-state wait, native request, and best-effort observability; root startup permission requests remain blocked until ATT settles. ATT presentation must never depend on analytics availability. Keep all advertising SDK initialization and conversion fanout behind the existing authorization gate.

**Tech Stack:** Expo SDK 56, React Native, TypeScript, Jest/React Native Testing Library, Fastlane deliver, Biome.

## Global Constraints

- Request ATT only on iOS, only while the app is active, and only while the native status is `undetermined`.
- Do not initialize advertising SDKs or send advertising conversions before ATT returns `granted`.
- Do not tie ATT presentation to a route that navigation can unmount.
- Do not allow startup notification permission requests to race the ATT request.
- Keep `add_id_info_uses_idfa: true` and the other IDFA submission answers aligned with runtime behavior.

---

### Task 1: Root-lifecycle ATT coordinator

**Files:**
- Create: `apps/mobile-storefront/hooks/use-app-tracking-transparency.ts`
- Create: `apps/mobile-storefront/hooks/use-app-tracking-transparency.test.tsx`
- Delete: `apps/mobile-storefront/components/home/useHomePermissionPrompt.ts`
- Delete: `apps/mobile-storefront/components/home/useHomePermissionPrompt.test.tsx`
- Modify: `apps/mobile-storefront/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `canRequestTrackingTransparency()`, `getTrackingPermissionStatus()`, `requestTrackingPermission()`, `AppState`, `recordCrashBreadcrumb()`, and `trackEvent()`.
- Produces: `useAppTrackingTransparency({ enabled }): { isTrackingAuthorizationSettled: boolean }`.

- [x] **Step 1: Write failing hook tests**

  Cover disabled startup, direct request while active, waiting for foreground, resolved status without another request, fail-closed errors, telemetry, and unmount cleanup. The key regression assertion mounts the hook independently of any route and enables it after the initial render.

  ```tsx
  const { result, rerender } = renderHook(
    ({ enabled }) => useAppTrackingTransparency({ enabled }),
    { initialProps: { enabled: false } }
  );
  expect(result.current.isTrackingAuthorizationSettled).toBe(false);
  rerender({ enabled: true });
  await waitFor(() => expect(mockRequestTrackingPermission).toHaveBeenCalledTimes(1));
  expect(result.current.isTrackingAuthorizationSettled).toBe(true);
  ```

- [x] **Step 2: Run the focused test and verify RED**

  Run: `pnpm --filter @baci/mobile-storefront test -- hooks/use-app-tracking-transparency.test.tsx --runInBand`

  Expected: FAIL because `use-app-tracking-transparency.ts` does not exist.

- [x] **Step 3: Implement the minimal root-lifecycle hook**

  The hook checks status once after `enabled`, waits on `AppState` if necessary, emits `ATT Status Checked`, `ATT Request Started`, `ATT Request Result`, or `ATT Request Error`, and settles after any resolved or fail-closed outcome.

  ```ts
  export function useAppTrackingTransparency({ enabled }: { enabled: boolean }) {
    const [isTrackingAuthorizationSettled, setSettled] = useState(
      () => !canRequestTrackingTransparency()
    );
    const hasStartedRef = useRef(false);

    useEffect(() => {
      if (!enabled || isTrackingAuthorizationSettled || hasStartedRef.current) return;
      hasStartedRef.current = true;
      // Read status, wait for AppState.active, request once, record the result,
      // and call setSettled(true) for resolved or fail-closed outcomes.
    }, [enabled, isTrackingAuthorizationSettled]);

    return { isTrackingAuthorizationSettled };
  }
  ```

- [x] **Step 4: Run the focused test and verify GREEN**

  Run: `pnpm --filter @baci/mobile-storefront test -- hooks/use-app-tracking-transparency.test.tsx --runInBand`

  Expected: PASS.

- [x] **Step 5: Remove the Home-owned request path**

  Remove the hook call/import from `app/(tabs)/index.tsx` and delete the obsolete Home hook and tests so navigation can no longer cancel ATT.

### Task 2: Root integration and permission serialization

**Files:**
- Modify: `apps/mobile-storefront/app/_layout.tsx`
- Modify: `apps/mobile-storefront/__tests__/app/_layout.test.tsx`

**Interfaces:**
- Consumes: Task 1's `useAppTrackingTransparency` return value.
- Produces: root-level ATT enablement after splash/analytics settlement; notification registration and due-savings notification activation gated by `isTrackingAuthorizationSettled`.

- [x] **Step 1: Add failing root integration tests**

  Assert that ATT remains disabled while the animated splash is visible, becomes enabled after the splash ends, and blocks startup notification registration until ATT settles.

  ```tsx
  expect(mockUseAppTrackingTransparency).toHaveBeenLastCalledWith({ enabled: false });
  fireEvent.press(screen.getByTestId('animated-splash'));
  await waitFor(() =>
    expect(mockUseAppTrackingTransparency).toHaveBeenLastCalledWith({ enabled: true })
  );
  ```

- [x] **Step 2: Run root tests and verify RED**

  Run: `pnpm --filter @baci/mobile-storefront test -- __tests__/app/_layout.test.tsx --runInBand`

  Expected: FAIL because `RootLayout` does not call the root ATT coordinator or gate permission-bearing startup work.

- [x] **Step 3: Implement minimal root integration**

  Call the coordinator from `RootLayout` and add the settled guard to push registration and due-savings activation effects.

  ```ts
  const { isTrackingAuthorizationSettled } = useAppTrackingTransparency({
    enabled: !showSplash && isInitialized && isStorageReady,
  });
  ```

- [x] **Step 4: Run root and hook tests and verify GREEN**

  Run: `pnpm --filter @baci/mobile-storefront test -- __tests__/app/_layout.test.tsx hooks/use-app-tracking-transparency.test.tsx --runInBand`

  Expected: PASS.

### Task 3: Automated App Review notes and release guardrail

**Files:**
- Modify: `apps/mobile-storefront/fastlane/Fastfile`
- Modify: `.github/workflows/ios-storefront-release.yml`
- Modify: `apps/mobile-storefront/scripts/check-ad-tracking-native-config.mjs`
- Modify: `apps/mobile-storefront/scripts/check-ad-tracking-native-config.test.ts`

**Interfaces:**
- Consumes: optional `IOS_REVIEW_NOTES`; defaults to explicit fresh-install ATT review instructions.
- Produces: `deliver` submission with `app_review_information.notes`, metadata upload enabled only for supplied review information, and a CI guard that rejects stale IDFA/review-note settings.

- [x] **Step 1: Add failing native-config guard tests**

  Assert that the committed Fastfile uploads ATT review notes, retains all IDFA answers, and does not skip the review-information metadata upload.

  ```ts
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('[ad-tracking-native-config] OK');
  // A temporary Fastfile with app_review_information removed must fail.
  ```

- [x] **Step 2: Run the guard test and verify RED**

  Run: `pnpm --filter @baci/mobile-storefront test -- scripts/check-ad-tracking-native-config.test.ts --runInBand`

  Expected: FAIL because build 511's Fastfile has no review notes and sets `skip_metadata: true`.

- [x] **Step 3: Implement review-note submission**

  Add a default note describing the fresh-install, post-splash ATT location; allow `IOS_REVIEW_NOTES` override; pass `{ notes: review_notes_text }` to `app_review_information`; pass the workflow variable; and set `skip_metadata: false` while continuing to skip screenshots and binary upload.

  ```ruby
  review_notes_text = ENV["IOS_REVIEW_NOTES"].to_s.strip
  review_notes_text = DEFAULT_ATT_REVIEW_NOTES if review_notes_text.empty?
  deliver_opts = {
    skip_metadata: false,
    skip_screenshots: true,
    app_review_information: { notes: review_notes_text }
  }
  ```

- [x] **Step 4: Run the guard and Ruby syntax checks**

  Run: `pnpm --filter @baci/mobile-storefront test -- scripts/check-ad-tracking-native-config.test.ts --runInBand`

  Run: `ruby -c apps/mobile-storefront/fastlane/Fastfile`

  Expected: PASS and `Syntax OK`.

### Task 4: Verification

**Files:**
- Verify all files above.

- [x] **Step 1: Run focused regression suites**

  Run: `pnpm --filter @baci/mobile-storefront test -- hooks/use-app-tracking-transparency.test.tsx __tests__/app/_layout.test.tsx scripts/check-ad-tracking-native-config.test.ts --runInBand`

- [x] **Step 2: Run required project quality gates**

  Run: `pnpm --filter @baci/mobile-storefront check:ad-tracking-native-config`

  Run: `pnpm turbo lint && pnpm turbo typecheck`

- [x] **Step 3: Run the mobile storefront test suite**

  Run: `pnpm --filter @baci/mobile-storefront test`

- [x] **Step 4: Review the final diff**

  Confirm no advertising gate was weakened, no route owns ATT, no secrets were added, and the release workflow submits review instructions.
