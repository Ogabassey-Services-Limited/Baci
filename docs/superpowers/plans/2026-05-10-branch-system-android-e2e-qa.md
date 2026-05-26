# Branch System Android E2E QA Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-android-apps:android-emulator-qa. Execute inline in this session only; do not use subagents for this QA pass. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify PR #1500 end-to-end on Android for branch scoping, branch creation/edit/deactivation, branch-aware dashboard/orders/expenses, and regression-safe app launch/navigation.

**Architecture:** Run the mobile-admin app on an Android emulator against a disposable QA merchant. Use adb/UIAutomator for deterministic navigation, screenshots, UI tree evidence, and logcat crash checks. Use direct Supabase cleanup for the disposable QA user/merchant only after the Android run is complete.

**Tech Stack:** Expo SDK 55, React Native 0.84, Android Gradle project under `apps/mobile-admin/android`, Supabase auth/database, Next.js API on `https://usebaci.com`, adb/UIAutomator from `$HOME/Library/Android/sdk`.

---

## Safety Rules

- Use a disposable QA email: `qa+branch-android-<timestamp>@usebaci.test`.
- Use a disposable store slug: `qa-branch-android-<timestamp>`.
- Do not mutate an existing merchant.
- Do not run destructive cleanup until screenshots/logs are collected.
- If registration fails because the production API rejects `.test` email domains, switch only the email domain to `usebaci.com` while keeping the `qa+branch-android-<timestamp>` prefix.
- If authenticated Android testing cannot proceed because the app cannot reach Supabase/API, stop after collecting logs and fix the connectivity/configuration bug before continuing.

---

## Files Touched During QA

- Create: `docs/superpowers/plans/2026-05-10-branch-system-android-e2e-qa.md`
- Modify only if bugs are found:
  - `apps/mobile-admin/**`
  - `apps/web/src/app/api/branches/**`
  - `apps/web/src/app/api/analytics/**`
  - `apps/web/src/schemas/branches.ts`
  - `supabase/migrations/*.sql` only with a new append-only migration
- Do not edit existing migrations.

---

## Task 1: Sync and Baseline Validation

- [ ] **Step 1: Confirm clean branch state**

Run:

```bash
git status -sb
git rev-list --left-right --count HEAD...origin/codex/branch-system-implementation
git rev-list --left-right --count HEAD...origin/main
```

Expected:

```text
## codex/branch-system-implementation...origin/codex/branch-system-implementation
0 0
<ahead-count> 0
```

- [ ] **Step 2: Run mobile-admin static/unit gates**

Run:

```bash
pnpm --filter baci-mobile-admin typecheck
pnpm --filter baci-mobile-admin test
pnpm --filter baci-mobile-admin lint
git diff --check
```

Expected:

```text
tsc --noEmit exits 0
Vitest exits 0
expo lint exits 0
git diff --check exits 0
```

---

## Task 2: Android Tooling and Emulator Setup

- [ ] **Step 1: Start the checked-in Android emulator launcher**

Run:

```bash
pnpm --filter baci-mobile-admin android:emulator
```

This is the only supported emulator launch path for agents and automation. The
launcher owns GPU mode, Quick Boot, ADB reset, boot waiting, Android settle
checks, the Metro ADB reverse, and ADB shell stability checks.
The default launcher AVD is `Baci_Pixel_9_Pro_XL_API_36_Google`, an Android 16
API 36 Google APIs Pixel 9 Pro XL profile with `auto` GPU, 2 CPU cores, and
4096 MB RAM.
Use `BACI_ANDROID_AVD_NAME` only for explicit emulator-infrastructure fallback
triage.

Build and install the debug APK only with:

```bash
cd apps/mobile-admin/android
./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain
cd ../../..
pnpm --filter baci-mobile-admin android:install
```

Then run Metro for Android with:

```bash
pnpm --filter baci-mobile-admin android:metro
```

Do not use a localhost-only Metro host for emulator QA; the dev client connects
through `10.0.2.2`.

Launch the Android dev client only with:

```bash
pnpm --filter baci-mobile-admin android:launch
```

Do not use raw `adb shell am start` commands for mobile-admin QA. The launcher
owns the Metro reverse, settled-load check, package force-stop, and Expo
dev-client URL.

Expected:

```text
Android emulator is ready on emulator-5554.
```

- [ ] **Step 2: Confirm adb sees the launched emulator**

Run:

```bash
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
"$ADB" -s emulator-5554 devices
"$ADB" -s emulator-5554 shell getprop sys.boot_completed
"$ADB" -s emulator-5554 shell echo ok
```

Expected:

```text
1
ok
```

- [ ] **Step 3: Save baseline emulator evidence**

Run:

```bash
"$ADB" devices
"$ADB" exec-out screencap -p > /tmp/baci-branch-qa-00-emulator-ready.png
"$ADB" logcat -c
```

Expected:

```text
One emulator device listed as device
Screenshot file is non-empty
Logcat cleared
```

---

## Task 3: Build and Install Mobile Admin Android

- [ ] **Step 1: Copy local mobile env into the isolated worktree without committing it**

Run:

```bash
cp /Users/mac/Baci-app/apps/mobile-admin/.env apps/mobile-admin/.env
git status --short apps/mobile-admin/.env
```

Expected:

```text
No tracked diff for apps/mobile-admin/.env
```

- [ ] **Step 2: Build and install debug app**

Run:

```bash
cd apps/mobile-admin/android
./gradlew :app:installDebug --console=plain
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 3: Launch installed package**

Run:

```bash
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
pnpm --filter baci-mobile-admin android:launch
sleep 5
"$ADB" -s emulator-5554 shell pidof -s com.ogabassey.baci
"$ADB" -s emulator-5554 exec-out screencap -p > /tmp/baci-branch-qa-01-launch.png
```

Expected:

```text
pid is non-empty
Screenshot shows onboarding/login/admin route, not a crash dialog
```

---

## Task 4: Disposable Merchant Registration

- [ ] **Step 1: Dump UI tree and locate auth entry**

Run:

```bash
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
"$ADB" exec-out uiautomator dump /dev/tty > /tmp/baci-branch-qa-auth.xml
python3 /Users/mac/.codex/plugins/cache/openai-curated/test-android-apps/63976030/skills/android-emulator-qa/scripts/ui_tree_summarize.py /tmp/baci-branch-qa-auth.xml /tmp/baci-branch-qa-auth-summary.txt
sed -n '1,160p' /tmp/baci-branch-qa-auth-summary.txt
```

Expected:

```text
Summary contains login, onboarding, or create-account controls.
```

- [ ] **Step 2: Register disposable account**

Use `ui_pick.py` to compute coordinates for each visible label before tapping:

```bash
QA_TS="$(date +%Y%m%d%H%M%S)"
QA_EMAIL="qa+branch-android-${QA_TS}@usebaci.test"
QA_PASSWORD="BranchQa-${QA_TS}!"
QA_BUSINESS="Branch QA ${QA_TS}"
QA_SLUG="qa-branch-android-${QA_TS}"
```

Fill fields:

```text
First Name: Branch
Last Name: QA
Email Address: $QA_EMAIL
Password: $QA_PASSWORD
Confirm Password: $QA_PASSWORD
Business Name: $QA_BUSINESS
Store Link: $QA_SLUG
Business Type: Electronics
```

Expected:

```text
App navigates to the admin dashboard.
Header/store text reflects the QA merchant.
No registration error alert is visible.
```

- [ ] **Step 3: Save registration evidence**

Run:

```bash
"$ADB" exec-out screencap -p > /tmp/baci-branch-qa-02-dashboard-after-register.png
"$ADB" logcat -d > /tmp/baci-branch-qa-02-after-register.log
```

Expected:

```text
Screenshot shows dashboard with branch switcher.
Logcat has no FATAL EXCEPTION for com.ogabassey.baci.
```

---

## Task 5: Dashboard Branch Switcher Flow

- [ ] **Step 1: Verify initial branch state**

Dump UI:

```bash
"$ADB" exec-out uiautomator dump /dev/tty > /tmp/baci-branch-qa-dashboard.xml
python3 /Users/mac/.codex/plugins/cache/openai-curated/test-android-apps/63976030/skills/android-emulator-qa/scripts/ui_tree_summarize.py /tmp/baci-branch-qa-dashboard.xml /tmp/baci-branch-qa-dashboard-summary.txt
sed -n '1,220p' /tmp/baci-branch-qa-dashboard-summary.txt
```

Expected:

```text
Contains "All locations", one default branch pill, and "Add".
Visits/New labels include "(all stores)".
```

- [ ] **Step 2: Create branch from dashboard**

Tap `Add new branch`, fill:

```text
Branch name: Android QA Branch
Address: 22 QA Avenue, Lagos
```

Submit.

Expected:

```text
Branch pill "Android QA Branch" appears.
"All locations" remains available.
No validation or network error alert.
```

- [ ] **Step 3: Switch branch scope and verify cache-sensitive UI**

Tap `Android QA Branch`.

Expected:

```text
Android QA Branch pill is selected.
Dashboard stats reload without crash.
Top products area does not reuse stale all-location loading/error state.
Visits/New labels remain explicitly all-store where applicable.
```

- [ ] **Step 4: Save branch switcher evidence**

Run:

```bash
"$ADB" exec-out screencap -p > /tmp/baci-branch-qa-03-dashboard-branch-selected.png
"$ADB" logcat -d > /tmp/baci-branch-qa-03-branch-switcher.log
```

Expected:

```text
Screenshot shows selected branch.
Logcat has no FATAL EXCEPTION.
```

---

## Task 6: Staff Accounts Branch Management Flow

- [ ] **Step 1: Navigate to staff accounts**

Use bottom navigation or menu to reach `Customers`/`Staff Accounts` depending on visible labels. Dump UI after navigation.

Expected:

```text
Screen contains staff accounts tabs and branch cards.
Only active branches are listed for assignment.
```

- [ ] **Step 2: Edit branch metadata**

Open `Android QA Branch`, change address to:

```text
33 QA Close, Ikeja
```

Save.

Expected:

```text
Branch card updates.
Modal closes.
No stale form state remains.
```

- [ ] **Step 3: Clear branch address**

Open `Android QA Branch`, clear the address field, save.

Expected:

```text
Save succeeds.
Reopening the branch does not show the old address.
```

- [ ] **Step 4: Deactivate branch**

Open `Android QA Branch`, tap deactivate, confirm.

Expected:

```text
Branch disappears from active list.
If it was the selected scope, app resets to "All locations".
The remaining branch cannot be deactivated from UI.
```

---

## Task 7: Expense Branch Flow

- [ ] **Step 1: Navigate to expenses list**

Expected:

```text
Expenses screen loads without raw Supabase errors.
Empty state or list is visible.
```

- [ ] **Step 2: Create expense under all-locations scope**

Tap add expense, verify a branch selector is present, choose the active/default branch, fill:

```text
Category: Other
Amount: 1234
Description: Android branch QA expense
```

Save.

Expected:

```text
Expense appears in list.
Expense detail opens and shows branch name.
No Invalid Date crash.
```

- [ ] **Step 3: Verify branch-filtered expense list**

Switch dashboard branch scope to the active/default branch and reopen expenses.

Expected:

```text
Expense remains visible for its branch.
Out-of-scope expense details are not accessible from another branch scope.
```

---

## Task 8: Order Branch Flow

- [ ] **Step 1: Navigate to add order**

Expected:

```text
New order screen loads.
Branch selector is visible when multiple active branches exist.
```

- [ ] **Step 2: Create or dry-run manual order**

If the app allows creating a minimal manual order without payment, create one assigned to the default branch. If required product/customer data is missing, stop at branch selector verification.

Expected:

```text
No branch selector crash.
Selected branch id persists through the order form.
```

---

## Task 9: Crash, Network, and Visual Regression Checks

- [ ] **Step 1: Check crash buffer**

Run:

```bash
"$ADB" logcat -b crash -d > /tmp/baci-branch-qa-crash.log
rg -n "FATAL EXCEPTION|com\\.ogabassey\\.baci" /tmp/baci-branch-qa-crash.log || true
```

Expected:

```text
No FATAL EXCEPTION for com.ogabassey.baci.
```

- [ ] **Step 2: Check app log for branch/API errors**

Run:

```bash
"$ADB" logcat -d > /tmp/baci-branch-qa-final.log
rg -n "BRANCH_NOT_FOUND|Merchant must have exactly one active default branch|Cannot deactivate|Network request failed|FATAL EXCEPTION" /tmp/baci-branch-qa-final.log || true
```

Expected:

```text
No unexpected branch/default/network fatal errors.
```

- [ ] **Step 3: Save final screenshot**

Run:

```bash
"$ADB" exec-out screencap -p > /tmp/baci-branch-qa-99-final.png
```

Expected:

```text
Screenshot is non-empty and shows a stable app screen.
```

---

## Task 10: Cleanup Disposable QA Data

- [ ] **Step 1: Identify created user and merchant**

Use service-role Supabase access from local env. Query by the QA email and slug only.

Expected:

```text
Exactly one QA user and one QA merchant match the timestamp.
```

- [ ] **Step 2: Delete QA rows in dependency order**

Delete or soft-delete only rows with the QA merchant id:

```text
expenses
orders/order_items if created
branches except required default branch if deletion is blocked
domains
staff_members
merchants
auth.users QA account
```

Expected:

```text
No rows remain for QA slug/email.
No non-QA rows are touched.
```

---

## Task 11: Fix and Revalidate Loop

- [ ] **Step 1: For every reproducible issue, write the smallest failing test first**

Expected:

```text
The test fails before implementation and names the behavior.
```

- [ ] **Step 2: Implement the minimal fix**

Allowed scopes:

```text
mobile-admin branch/dashboard/orders/expenses files
web branch/analytics API files
new append-only Supabase migration only if DB behavior is wrong
```

- [ ] **Step 3: Re-run targeted tests**

Expected:

```text
New failing test now passes.
Related existing tests still pass.
```

- [ ] **Step 4: Re-run Android flow from the failed step forward**

Expected:

```text
The original emulator reproduction no longer fails.
No new crash/log errors appear.
```

- [ ] **Step 5: Run final gate and push**

Run:

```bash
pnpm --filter baci-mobile-admin typecheck
pnpm --filter baci-mobile-admin test
pnpm --filter baci-mobile-admin lint
git diff --check
git push origin codex/branch-system-implementation
```

Expected:

```text
All commands exit 0.
Pre-push hook exits 0.
```

---

## Completion Evidence

Final report must include:

- Exact commit SHA tested.
- Whether the emulator was cold-booted or reused.
- QA email/slug pattern, without password.
- Screenshots saved under `/tmp/baci-branch-qa-*.png`.
- Log files saved under `/tmp/baci-branch-qa-*.log`.
- Static/unit commands and results.
- Android build/install command and result.
- Each manual flow: passed, fixed, or blocked with concrete reason.
- Cleanup result for disposable QA data.

---

## Execution Notes: 2026-05-10

- Emulator: reused `Medium_Phone_API_36.1`, then wiped and restarted with working DNS.
- Disposable merchant: `qabranch1778414025.usebaci.com`; disposable email pattern stored locally in `/tmp/baci-qa-email.txt`.
- Screenshots/UI dumps saved under `/tmp/baci-branch-qa-*` and `/tmp/baci-*`.
- Baseline static/unit gates passed before Android QA:
  - `pnpm --filter baci-mobile-admin typecheck`
  - `pnpm --filter baci-mobile-admin test`
  - `pnpm --filter baci-mobile-admin lint`
  - `git diff --check`
- Android build/install passed with `./gradlew :app:installDebug --console=plain`.
- Branch creation passed from the Android UI: created `Warehouse`, then `Depot`.
- Branch edit passed after running the current worktree web server on port 3001 with web env loaded: renamed `Warehouse` to `Warehouse2`.
- Fixed during QA: Expo Router treated colocated helper files under `app/(admin)/expenses` as routes, so expense helper components/styles/types were moved to `components/expenses` with tests preserved.
- Fixed during QA: all-location dashboard stats selected `orders.branch_id` through the `order_items` join even when scope was `all`, which fails against schemas that have not applied branch columns. The all-location select now omits branch columns; branch-scoped selects still require the migration.
- Blocked by environment, not app code: branch-scoped dashboard and branch deactivation could not be fully verified against the connected Supabase project because it has `branches` but lacks this PR's `orders.branch_id`, `expenses.branch_id`, and `deactivate_branch(p_branch_id)` RPC. Re-run those steps after applying `20260430120000_branch_scope_foundation.sql` to the target QA database.
- Final validation after fixes:
  - `pnpm --filter @baci/web test -- branches.test.ts` ran the web suite and passed: 912 files passed, 1 skipped, 7501 tests passed, 1 todo.
  - `pnpm --filter baci-mobile-admin typecheck` passed.
  - `pnpm --filter baci-mobile-admin lint` passed.
  - `pnpm --filter baci-mobile-admin test` passed: 237 files, 1070 tests.
  - `git diff --check` passed.
