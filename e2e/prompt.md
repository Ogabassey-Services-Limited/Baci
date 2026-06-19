# Baci storefront E2E loop — iteration prompt

You are running an autonomous **test → find-bug → fix → re-verify** loop on the Baci apps.
Drive the real running app like a user, click/tap everything in the plan, and fix every bug
you find in the app source — then prove the fix with fresh evidence.

## Target order (STRICT — storefront before admin)

1. `e2e/storefront-web`  — Next.js customer storefront (driver: **chrome-devtools** MCP)
2. `e2e/storefront-app`  — Expo mobile storefront (driver: **mobile-mcp**)
3. `e2e/admin`           — Expo mobile admin — **only after BOTH storefronts are fully green**

Work the **first** target whose `status.json` still has any case with status `pending` or `fail`.
Never start a later target until every earlier target's cases are `pass` or `knownIssue`.

## Each iteration

1. Read the active target's `status.json` and `test-plan.md`.
2. Pick the next case, by priority:
   a. `testing` (resume an in-progress case)
   b. `fail` with `fixAttempts` < 3
   c. `pending`
   Mark it `testing`, set `lastTestedAt` (ask the shell for the timestamp — do not invent one).
3. Make sure the app under test is running (see **Setup per target**). Start it if needed.
4. Execute the case as a real user with the right driver:
   - **storefront-web** → chrome-devtools MCP: `navigate_page`, `take_snapshot`, `click`, `fill`,
     `fill_form`, `hover`, `take_screenshot`, `list_console_messages`, `list_network_requests`,
     and `lighthouse_audit` where the case asks for it.
   - **storefront-app** → mobile-mcp: list devices / use the booted one, launch the app, read the
     accessibility snapshot, `tap`/`type`/`swipe`, take a screenshot; read `adb logcat` (Android)
     or simulator logs for errors.
5. **Observe ground truth.** Capture, THIS iteration, for THIS case:
   - a fresh screenshot → save under `e2e/<target>/evidence/<caseId>-<n>.png`
   - the console messages (web) or logcat / red-box state (app)
   - relevant network responses (web): flag any 4xx/5xx
6. Compare to the case's **Expected** result:
   - **PASS** → set `status: "pass"`, record the evidence path, clear stale notes.
   - **FAIL** → write a precise note (what you saw vs expected + the exact console/log error).
     Find the **root cause in the app source** and fix it **in code, not in the test plan**.
     Increment `fixAttempts`, keep `status: "fail"` so the next iteration re-runs this same case.
   - After **3** failed fix attempts → set `status: "knownIssue"` with a clear writeup, then move on.
7. Append a dated entry to `e2e/<target>/results.md`: case id, verdict, what you found, what you
   changed (files), and the evidence path.
8. For any file you changed, run `pnpm turbo lint` and the relevant `typecheck` / `test`
   (`pnpm --filter @baci/web ...` or `pnpm --filter @baci/mobile-storefront ...`). Do not leave the
   tree red — a broken lint/type is itself a fail to fix before moving on.

## Anti-hallucination rules (do not skip)

- NEVER mark a case `pass` without a fresh screenshot **and** a clean console/log captured THIS iteration.
- NEVER weaken or delete a test case to make it pass — fix the app instead.
- If you genuinely cannot drive the app (no device booted, driver not connected, server won't start),
  set the case to `testing`, write the exact blocker in `results.md`, and STOP. Do not fabricate results.
- Only fix app code. Do not touch `apps/web/src/proxy.ts`, `src/config/business-types.ts`, or existing
  `supabase/migrations/*` (protected). If a bug traces there, write it up as `knownIssue` and flag it.

## Data safety — the apps write to PRODUCTION (do not skip)

The mobile **admin** app is signed into the REAL merchant on the PRODUCTION Supabase. Submitting a form
persists to live data. Filling + saving settings forms here has already corrupted real merchant data
(social handles overwritten with random strings like `huvmyo`/`eomsdv`, `support_email` reset to the login
email). To test a form WITHOUT corrupting production:

- NEVER tap **Save**/submit on an admin form that writes merchant identity/config — Store settings, Social
  media, Profile, Payment methods, Sales channels, Shipping, Domains, KYC. Exercise the field input and
  validation up to the Save button, then **back out without saving**.
- NEVER type throwaway/random text into a field you will then persist on the live merchant.
- A case that genuinely must verify a write path MUST use a dedicated throwaway test merchant — never the
  real store. Without one, mark the case `knownIssue` ("needs test merchant") instead of saving to prod.
- Read-only flows (viewing, navigation, validation-without-save) are always fine.

## Done

A target is done when its `status.json` has zero `pending`/`fail`. When **storefront-web AND
storefront-app** are both fully green (all `pass`/`knownIssue`), announce it, summarize the bugs
fixed, and only then begin `e2e/admin`. The whole goal is done when all three targets are done;
emit `ALL_GREEN` when you reach that state.

## Setup per target

### storefront-web
- Start dev server (background): `pnpm --filter @baci/web dev`  (serves on `http://localhost:3000`).
- Local storefronts are **slug-prefixed**: the demo merchant renders at
  `http://localhost:3000/ogabassey`. Case **T0** confirms the working storefront URL first; use
  whatever slug T0 establishes for all later cases.

### storefront-app
- Start Metro (background): `pnpm --filter @baci/mobile-storefront start`  (port 8082).
- Boot a device, then run the app once:
  - iOS sim: `pnpm --filter @baci/mobile-storefront ios`
  - Android emu: `pnpm --filter @baci/mobile-storefront android`
- mobile-mcp auto-detects the booted simulator/emulator. Use `adb logcat` (Android) for error capture.
- Respect `apps/mobile-storefront/AGENTS.md`: keyboard-avoidance / platform-drift bugs need a
  regression test **or** a shared-primitive fix, not a one-off `Platform.OS` branch.
