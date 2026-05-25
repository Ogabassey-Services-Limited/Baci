# Expo SDK 56 Full Mobile Upgrade Implementation Plan

> **Execution constraint:** Do not use subagents for this upgrade. Execute inline in one thread/worktree, use `expo:upgrading-expo` before changing dependencies or native projects, and stop at every Phase Review Gate before continuing. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade both Baci mobile apps from Expo SDK 55 to Expo SDK 56, including React Native 0.85, iOS 16.4 support policy, Expo Router navigation import migration, `@expo/vector-icons` replacement, native project regeneration, patch audit, and end-to-end verification.

**Implementation status, 2026-05-24:** Implemented in isolated worktree `/Users/mac/Baci-expo-sdk-56` on branch `codex/expo-sdk-56-mobile-upgrade`, then rebased onto current `origin/main`. Final phase review found no remaining blocking SDK 56 issues after dependency checks, static scans, Expo Doctor classification, full lint/typecheck/test gates, Test Android Apps emulator QA, and sequential Android debug builds for both mobile apps. See `docs/superpowers/reviews/2026-05-21-expo-sdk-56-phase-gates.md` for the evidence log. The release-owner/App Store Connect items under "Release Decision" remain manual release tasks and were not completed by code changes.

**Architecture:** Do the upgrade in a fresh worktree from `origin/main`, then move through one shared dependency/native upgrade path for both Expo apps. Execute each phase inline, then step back at a blocking review gate to compare the completed diff against current Expo documentation, live npm metadata, and the Expo versions endpoint before proceeding. Run official Expo CLI upgrades and codemods early, using an isolated-worktree codemod workaround only where a tool requires a clean git tree, then manually harden the known Baci seams: static icon font plugins, root font loading, React Navigation imports, file-system copy/move behavior, patch-package entries, platform drift, and mobile build gates. Keep product UI redesign out of this PR; use SDK 56 visual/runtime improvements only where they are required for compatibility or low-risk polish.

**Tech Stack:** Expo SDK 56.0.0 / `expo@~56.0.4`, React Native 0.85.3, React 19.2.3, Expo Router SDK 56, React Native Vector Icons package-per-family packages, pnpm 10, Turborepo, Vitest/Jest, Android Gradle, CocoaPods/Xcode.

---

## Current Repo Facts

- Current root branch may be dirty; execute from a fresh worktree, not the current checkout.
- `apps/mobile-admin/package.json` currently uses `expo@^55.0.9`, `react-native@0.84.1`, `@expo/vector-icons`, and `@react-navigation/native`.
- `apps/mobile-storefront/package.json` currently uses `expo@^55.0.9`, `react-native@0.84.1`, `@expo/vector-icons`, `@react-navigation/native`, and `jest-expo@~55.0.11`.
- Root `pnpm.overrides` currently pins native packages including `react-native-worklets`, `react-native-reanimated`, `react-native-screens`, and `react-native-svg`; audit those pins against the SDK 56 resolver so they do not force stale native versions after `expo install --fix`.
- Expo's version endpoint currently maps SDK 56 to `expo@~56.0.3`, React Native `0.85.3`, and React `19.2.3`.
- SDK 56 requires iOS 16.4+. Baci's admin app still has `minimumOSVersion: '15.1'`; native iOS projects also carry 15.1 deployment targets.
- Icon inventory before migration:
  - 293 value imports: `import { Ionicons } from '@expo/vector-icons';`
  - 7 type imports: `import type { Ionicons } from '@expo/vector-icons';`
  - 2 mixed imports: `import { Feather, Ionicons } from '@expo/vector-icons';`
  - 2 default imports: `import FontAwesome from '@expo/vector-icons/FontAwesome';`
  - 432 total `@expo/vector-icons` references across app code, package files, tests, and setup; 126 are in tests/setup mocks.
  - Root font preload references in both `app/_layout.tsx` files: `...FontAwesome.font`, `...Ionicons.font`
- React Navigation inventory before migration:
  - `apps/mobile-admin/app/_layout.tsx`
  - `apps/mobile-storefront/components/navigation/RootLayoutNav.tsx`
  - `apps/mobile-storefront/components/navigation/CompactStackHeader.tsx` is currently unused outside its own test and a stale mock; Expo's SDK 56 codemod does not support `@react-navigation/native-stack`, so remove this dead component instead of trying to map its native-stack types.
  - `apps/mobile-storefront/components/storefront/ProductGrid.tsx`
  - `apps/mobile-storefront/components/navigation/RootLayoutNav.test.tsx`
  - `apps/mobile-storefront/components/storefront/ProductGrid.test-utils.tsx`

## Release Decision

- [ ] Confirm with product/release owner that dropping iOS 15 is acceptable.
- [ ] In App Store Connect, keep the final SDK 55/iOS 15-compatible version available under Last-Compatible Version Settings.
- [ ] Before release, verify backend/API compatibility for the final SDK 55 app version, because iOS 15 users will remain pinned to that binary.
- [ ] Do not advertise visual redesign as part of this upgrade. SDK 56 may improve startup, animations, native module performance, and build speed; visible UI changes must be deliberate follow-up work.

## Execution Model And Phase Review Gates

- No subagents. Do the work inline in this session or an equivalent single-worker execution.
- A Phase Review Gate is blocking. At each gate, stop, refresh the live metadata below, compare the phase diff against current Expo docs, patch any mismatch, rerun the gate, then continue.
- If npm `latest` or Expo's versions endpoint no longer describes SDK 56 as the current stable SDK, pause and amend this plan before touching more code. Do not silently upgrade beyond SDK 56 unless product explicitly chooses that newer SDK.
- If SDK 56 is still current but the patch version changes, update this plan's pinned Expo version, dependency expectations, and PR body before continuing.
- Each gate summary must be written to `docs/superpowers/reviews/2026-05-21-expo-sdk-56-phase-gates.md` and must record the check date, the Expo SDK docs pages reviewed, the live `expo`, `expo-router`, `expo-file-system`, and RNVI package metadata, any mismatch found, and the exact fix or "no changes needed".
- Required Expo docs for review gates:
  - Expo SDK reference: `https://docs.expo.dev/versions/latest/`
  - Expo SDK upgrade walkthrough: `https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/`
  - Expo Router SDK 55 to 56 migration: `https://docs.expo.dev/router/migrate/sdk-55-to-56/`
  - Expo FileSystem reference for Task 6: `https://docs.expo.dev/versions/latest/sdk/filesystem/`

At every Phase Review Gate, run this live metadata refresh first:

```bash
cd /Users/mac/Baci-expo-sdk-56
pnpm view expo version dist-tags --json > /tmp/baci-expo-sdk56-expo-npm.json
pnpm view expo-router version dist-tags --json > /tmp/baci-expo-sdk56-router-npm.json
pnpm view expo-file-system version > /tmp/baci-expo-sdk56-filesystem-version.txt
pnpm view @react-native-vector-icons/codemod version > /tmp/baci-expo-sdk56-rnvi-codemod-version.txt
pnpm view @react-native-vector-icons/ionicons version exports --json > /tmp/baci-expo-sdk56-rnvi-ionicons.json
pnpm view @react-native-vector-icons/fontawesome version exports --json > /tmp/baci-expo-sdk56-rnvi-fontawesome.json
pnpm view @react-native-vector-icons/feather version exports --json > /tmp/baci-expo-sdk56-rnvi-feather.json
curl -fsSL https://exp.host/--/api/v2/versions > /tmp/baci-expo-sdk56-versions.json
node - <<'NODE'
const { readFileSync } = require('node:fs');
const expo = JSON.parse(readFileSync('/tmp/baci-expo-sdk56-expo-npm.json', 'utf8'));
const router = JSON.parse(readFileSync('/tmp/baci-expo-sdk56-router-npm.json', 'utf8'));
const versions = JSON.parse(readFileSync('/tmp/baci-expo-sdk56-versions.json', 'utf8'));
const rnviIonicons = JSON.parse(readFileSync('/tmp/baci-expo-sdk56-rnvi-ionicons.json', 'utf8'));
const rnviFontAwesome = JSON.parse(readFileSync('/tmp/baci-expo-sdk56-rnvi-fontawesome.json', 'utf8'));
const rnviFeather = JSON.parse(readFileSync('/tmp/baci-expo-sdk56-rnvi-feather.json', 'utf8'));
const sdk56 = versions.sdkVersions['56.0.0'];
const summary = {
  checkedAt: new Date().toISOString(),
  expoNpmVersion: expo.version,
  expoLatest: expo['dist-tags']?.latest,
  expoNext: expo['dist-tags']?.next,
  expoSdk55: expo['dist-tags']?.['sdk-55'],
  expoSdk56FromVersionsEndpoint: sdk56?.expoVersion,
  reactNativeFromVersionsEndpoint: sdk56?.facebookReactNativeVersion,
  reactFromVersionsEndpoint: sdk56?.facebookReactVersion,
  typescriptFromVersionsEndpoint: sdk56?.relatedPackages?.typescript,
  typesReactFromVersionsEndpoint: sdk56?.relatedPackages?.['@types/react'],
  expoRouterNpmVersion: router.version,
  expoRouterLatest: router['dist-tags']?.latest,
  expoFileSystemNpmVersion: readFileSync('/tmp/baci-expo-sdk56-filesystem-version.txt', 'utf8').trim(),
  rnviCodemodNpmVersion: readFileSync('/tmp/baci-expo-sdk56-rnvi-codemod-version.txt', 'utf8').trim(),
  rnviIoniconsVersion: rnviIonicons.version,
  rnviIoniconsHasStaticExport: Boolean(rnviIonicons.exports?.['./static']),
  rnviFontAwesomeVersion: rnviFontAwesome.version,
  rnviFontAwesomeHasStaticExport: Boolean(rnviFontAwesome.exports?.['./static']),
  rnviFeatherVersion: rnviFeather.version,
  rnviFeatherHasStaticExport: Boolean(rnviFeather.exports?.['./static']),
};
console.log(JSON.stringify(summary, null, 2));
if (!summary.expoLatest?.startsWith('56.') || !summary.expoSdk56FromVersionsEndpoint?.startsWith('~56.')) {
  console.error('Expo latest metadata is no longer SDK 56. Stop and decide whether this plan should remain pinned to SDK 56.');
  process.exitCode = 1;
}
if (summary.expoLatest !== summary.expoSdk56FromVersionsEndpoint?.replace(/^~/, '')) {
  console.error('Expo SDK 56 patch metadata changed. Stop and update this plan before continuing.');
  process.exitCode = 1;
}
if (summary.reactNativeFromVersionsEndpoint !== '0.85.3' || summary.reactFromVersionsEndpoint !== '19.2.3') {
  console.error('Expo SDK 56 RN/React mapping changed. Stop and update dependency targets before continuing.');
  process.exitCode = 1;
}
if (!summary.rnviIoniconsHasStaticExport || !summary.rnviFontAwesomeHasStaticExport || !summary.rnviFeatherHasStaticExport) {
  console.error('RNVI package static exports changed. Stop and update the icon migration before continuing.');
  process.exitCode = 1;
}
NODE
```

Before Gate 0, create the review log:

```bash
cd /Users/mac/Baci-expo-sdk-56
mkdir -p docs/superpowers/reviews
cat > docs/superpowers/reviews/2026-05-21-expo-sdk-56-phase-gates.md <<'EOF'
# Expo SDK 56 Phase Review Gates

This file records the inline phase review gates for the Expo SDK 56 mobile upgrade. Do not proceed past a gate until its section is filled with the live metadata summary, docs reviewed, mismatch assessment, and any fixes made.

EOF
```

## Files Expected To Change

- Create: `docs/superpowers/plans/2026-05-21-expo-sdk-56-full-mobile-upgrade.md`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `docs/superpowers/reviews/2026-05-21-expo-sdk-56-phase-gates.md`
- Modify: `apps/mobile-admin/package.json`
- Modify: `apps/mobile-storefront/package.json`
- Modify: `apps/mobile-admin/app.config.ts`
- Modify: `apps/mobile-storefront/app.config.ts`
- Modify: `apps/mobile-admin/plugins/with-ios-release-hardening.ts`
- Modify: `apps/mobile-admin/plugins/with-ios-release-hardening.js`
- Modify: `apps/mobile-admin/app/_layout.tsx`
- Modify: `apps/mobile-storefront/app/_layout.tsx`
- Modify: `apps/mobile-admin/ios/**`
- Modify: `apps/mobile-admin/android/**`
- Modify: `apps/mobile-storefront/ios/**`
- Modify: `apps/mobile-storefront/android/**`
- Rename: `apps/mobile-admin/__tests__/config/sdk55-compliance.test.ts` -> `apps/mobile-admin/__tests__/config/sdk56-compliance.test.ts`
- Rename: `apps/mobile-storefront/__tests__/config/sdk55-compliance.test.ts` -> `apps/mobile-storefront/__tests__/config/sdk56-compliance.test.ts`
- Delete: `apps/mobile-storefront/components/navigation/CompactStackHeader.tsx`
- Delete: `apps/mobile-storefront/components/navigation/CompactStackHeader.test.tsx`
- Delete: `apps/mobile-admin/app/(admin)/payout-settings.tsx.orig`
- Delete: `apps/mobile-admin/app.json.backup`
- Delete: `apps/mobile-storefront/raw_build.log`
- Modify: icon imports under `apps/mobile-admin/{app,components,hooks,lib,utils}/**`
- Modify: icon imports under `apps/mobile-admin/context/**`
- Modify: icon imports under `apps/mobile-storefront/{app,components,hooks,lib,services}/**`
- Modify: icon and navigation mocks under `apps/mobile-admin/**/*.test.*`, `apps/mobile-storefront/**/*.test.*`, and `apps/mobile-storefront/jest.setup.ts`
- Modify: React Navigation mocks in `apps/mobile-storefront/components/navigation/RootLayoutNav.test.tsx` and `apps/mobile-storefront/components/storefront/ProductGrid.test-utils.tsx`
- Modify: `apps/mobile-admin/vitest.config.ts`
- Modify: `apps/mobile-storefront/jest.config.js`
- Modify: React Navigation imports under the specific files listed above
- Modify: root `pnpm.overrides` entries only when an override pins a package below the SDK 56-compatible version and is not still needed for a documented security or install workaround
- Modify, rebase, or delete: files under `patches/` after classifying each patched dependency as obsolete SDK/RN shim, still-needed Baci fix, or unrelated third-party fix
- Do not modify: `apps/web/src/proxy.ts`
- Do not edit existing files under `supabase/migrations/`
- Do not commit `.env*` files

---

## Task 1: Create Isolated Worktree And Baseline

- [ ] **Step 1: Refresh main and create the worktree**

Run:

```bash
cd /Users/mac/Baci-app
git fetch origin main
git worktree add -b codex/expo-sdk-56-mobile-upgrade /Users/mac/Baci-expo-sdk-56 origin/main
cd /Users/mac/Baci-expo-sdk-56
git status -sb
```

Expected:

```text
## codex/expo-sdk-56-mobile-upgrade...origin/main
```

- [ ] **Step 2: Copy the finalized plan into the isolated worktree**

Run from the original checkout that contains this reviewed plan:

```bash
mkdir -p /Users/mac/Baci-expo-sdk-56/docs/superpowers/plans
cp /Users/mac/Baci-app/docs/superpowers/plans/2026-05-21-expo-sdk-56-full-mobile-upgrade.md /Users/mac/Baci-expo-sdk-56/docs/superpowers/plans/2026-05-21-expo-sdk-56-full-mobile-upgrade.md
```

Expected:

```text
The isolated worktree contains the final reviewed plan even though the source checkout had it as an untracked file.
```

- [ ] **Step 3: Install current dependencies before changing versions**

Run:

```bash
pnpm install --frozen-lockfile
pnpm --filter baci-mobile-admin typecheck
pnpm --filter @baci/mobile-storefront typecheck
pnpm --filter baci-mobile-admin check:platform-drift
pnpm --filter @baci/mobile-storefront check:platform-drift
```

Expected:

```text
`pnpm install --frozen-lockfile` and the four baseline checks exit 0 on the pre-upgrade baseline.
```

- [ ] **Step 4: Capture baseline package/native state**

Run:

```bash
pnpm view expo version dist-tags --json
curl -fsSL https://exp.host/--/api/v2/versions | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const v=JSON.parse(s).sdkVersions["56.0.0"]; console.log(JSON.stringify({expoVersion:v.expoVersion, reactNativeVersion:v.facebookReactNativeVersion, reactVersion:v.facebookReactVersion}, null, 2));});'
rg -n '"expo"|"react-native"|"react"|"jest-expo"|@expo/vector-icons|@react-navigation/native' apps/mobile-admin/package.json apps/mobile-storefront/package.json
find apps/mobile-admin apps/mobile-storefront -maxdepth 2 \( -name android -o -name ios \) -type d -print
node -v
xcodebuild -version
java -version
```

Expected:

```text
expo latest is 56.x. If npm latest has moved beyond 56 by the time this plan is executed, keep Task 2 pinned to expo@~56.0.3 unless product explicitly chooses a newer SDK.
SDK 56 maps to React Native 0.85.x and React 19.2.3
Both apps currently show Expo 55 / RN 0.84 before the upgrade
Both apps have ios/ and android/ directories
Node is 22.13+; this repo currently requires Node 24.x, which also satisfies the SDK 56 floor.
Xcode is 26.2+.
Java is available for Gradle.
```

---

## Phase Review Gate 0: Baseline And SDK Target

- [ ] **Step 1: Refresh live Expo metadata**

Run the live metadata refresh from `Execution Model And Phase Review Gates`.

Expected:

```text
The metadata summary still reports expo latest 56.0.3, SDK 56 expoVersion ~56.0.3, React Native 0.85.3, React 19.2.3, TypeScript ~6.0.3, and @types/react ~19.2.14.
If this fails because a newer Expo SDK is now latest, stop here and update the plan or get explicit product approval to remain pinned to SDK 56.
```

- [ ] **Step 2: Compare the baseline against Expo docs**

Review:

```text
https://docs.expo.dev/versions/latest/
https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
```

Expected:

```text
The plan's target matrix still matches Expo's current SDK reference: SDK 56 uses React Native 0.85, React 19.2.3, Node 22.13.x or newer, Android compile/target SDK 36, iOS 16.4+, and Xcode 26.2+.
The execution path still follows Expo's upgrade walkthrough: install the target expo package, run expo install --fix, run expo-doctor, then update native projects.
```

- [ ] **Step 3: Step-back decision**

Append a short gate note to `docs/superpowers/reviews/2026-05-21-expo-sdk-56-phase-gates.md` before continuing:

```text
Gate 0 result:
- Docs checked:
- Live metadata:
- Baseline mismatch found:
- Plan/code changes made before proceeding:
```

Expected:

```text
No dependency or native changes start until this gate is documented and any mismatch is fixed.
```

## Task 2: Upgrade Expo SDK Dependencies

- [ ] **Step 1: Upgrade mobile-admin through Expo CLI**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56/apps/mobile-admin
pnpm exec expo install expo@~56.0.3
pnpm exec expo install --fix
pnpm dlx expo-doctor@latest
```

Expected:

```text
expo-doctor exits 0 or reports only issues that are fixed in later tasks in this plan.
```

If `expo install --fix` exits because it cannot write dynamic config, add the exact SDK 56 plugin names it prints to `app.config.ts` before retrying. For `mobile-admin`, this includes the existing explicit `expo-splash-screen`, `expo-web-browser`, `expo-font`, and `expo-sharing` plugins. For `mobile-storefront`, this includes explicit `expo-splash-screen`, `expo-font`, `expo-image`, `expo-sharing`, `expo-tracking-transparency`, and `expo-web-browser` plugins.

- [ ] **Step 2: Upgrade mobile-storefront through Expo CLI**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56/apps/mobile-storefront
pnpm exec expo install expo@~56.0.3
pnpm exec expo install --fix
pnpm dlx expo-doctor@latest
```

Expected:

```text
expo-doctor exits 0 or reports only issues that are fixed in later tasks in this plan.
```

If `expo install --fix` exits because it cannot write dynamic config, add the exact SDK 56 plugin names it prints to `app.config.ts` before retrying. For `mobile-storefront`, this includes explicit `expo-splash-screen`, `expo-font`, `expo-image`, `expo-sharing`, `expo-tracking-transparency`, and `expo-web-browser` plugins.

- [ ] **Step 3: Confirm package version alignment**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
rg -n '"expo"|"react-native"|"react"|"react-dom"|"jest-expo"|"react-test-renderer"|"typescript"|"@types/react"' apps/mobile-admin/package.json apps/mobile-storefront/package.json
pnpm install
```

Expected:

```text
apps/mobile-admin uses Expo 56-compatible Expo packages, React 19.2.3, React Native 0.85.x, TypeScript ~6.0.3, and @types/react 19.2.14.
apps/mobile-storefront uses Expo 56-compatible Expo packages, React 19.2.3, React Native 0.85.x, jest-expo 56.x, react-test-renderer 19.2.3, TypeScript ~6.0.3, and @types/react 19.2.14.
The root package's TypeScript version is not changed just for the mobile SDK upgrade unless a root gate proves it is required.
pnpm-lock.yaml is updated.
```

- [ ] **Step 4: Audit root overrides that can pin stale SDK 55 native packages**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
node - <<'NODE'
const { readFileSync } = require('node:fs');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const overrides = pkg.pnpm?.overrides ?? {};
for (const name of [
  'react-native-worklets',
  'react-native-reanimated',
  'react-native-screens',
  'react-native-safe-area-context',
  'react-native-svg',
  '@types/react',
]) {
  if (Object.prototype.hasOwnProperty.call(overrides, name)) {
    console.log(`${name}\t${overrides[name]}`);
  }
}
NODE
pnpm --dir apps/mobile-admin exec expo install --check
pnpm --dir apps/mobile-storefront exec expo install --check
for app in baci-mobile-admin @baci/mobile-storefront; do
  echo "Installed native package versions for $app"
  pnpm --filter "$app" exec node - <<'NODE'
const packages = [
  'react-native-worklets',
  'react-native-reanimated',
  'react-native-screens',
  'react-native-safe-area-context',
  'react-native-svg',
];
for (const packageName of packages) {
  try {
    const version = require(`${packageName}/package.json`).version;
    console.log(`${packageName}\t${version}`);
  } catch {
    console.log(`${packageName}\tMISSING`);
  }
}
NODE
done
```

Expected:

```text
No root override forces a native package below the version Expo SDK 56 expects.
Security or pnpm-install workaround overrides are preserved only when they still satisfy Expo's SDK 56 version range.
The installed-version printout from each app matches the SDK 56-compatible versions selected by expo install --fix.
If expo install --check or the installed-version printout shows a package kept stale by a root override, update or remove that override, preserve its overrideNotes rationale if still relevant, then rerun pnpm install, both expo install --check commands, and both installed-version printouts.
```

- [ ] **Step 5: Clear install-blocking stale patch-package entries immediately**

If the `pnpm install` in Step 3 fails because a `patchedDependencies` target is no longer present after SDK 56 resolution, inspect every current patch target, not only Expo-named packages:

```bash
cd /Users/mac/Baci-expo-sdk-56
node - <<'NODE'
const { readFileSync } = require('node:fs');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const patched = pkg.pnpm?.patchedDependencies ?? {};
for (const [target, patchFile] of Object.entries(patched)) {
  console.log(`${target}\t${patchFile}`);
}
NODE
rg -n "^diff --git|^--- |^\\+\\+\\+|55\\.0|0\\.84\\.1|@expo/log-box|expo-dev-launcher|expo-dev-menu|expo-modules|expo-updates|expo@|react-native@" patches package.json
```

For each patch target that `pnpm install` says was not applied:

1. Open its patch file and identify whether it is an SDK/RN compatibility shim, a local Baci bug fix, or a third-party library fix that may still be needed.
2. If the patched package is gone from the SDK 56 graph, remove only that `pnpm.patchedDependencies` entry and its matching file under `patches/`.
3. If the same package is still present at a new version, keep the patch intent and rebase it to the SDK 56 package version instead of silently dropping it.

Then rerun:

```bash
pnpm install
```

Expected:

```text
pnpm install exits 0 before any codemod or prebuild step runs.
Any removed patch target is proven obsolete because its package is absent from the resolved SDK 56 graph or the patch was an SDK 55 / React Native 0.84 compatibility shim.
Patches for packages still present after SDK 56 are not removed here; rebase those now if they block install, or rebase them in Task 7 if they fail after native regeneration.
```

---

## Task 3: Set iOS 16.4 And Build Properties Explicitly

- [ ] **Step 1: Update mobile-admin Expo build properties**

Modify `apps/mobile-admin/app.config.ts`.

Replace the existing string plugin:

```ts
'expo-build-properties',
```

with:

```ts
[
  'expo-build-properties',
  {
    android: {
      compileSdkVersion: 36,
      targetSdkVersion: 36,
      buildToolsVersion: '36.0.0',
    },
    ios: {
      deploymentTarget: '16.4',
    },
  },
],
```

Also change the iOS hardening plugin option:

```ts
minimumOSVersion: '15.1',
```

to:

```ts
minimumOSVersion: '16.4',
```

Then update the admin iOS hardening plugin defaults so the plugin cannot silently reintroduce an SDK 56-incompatible deployment target if the app-config option is later removed. In `apps/mobile-admin/plugins/with-ios-release-hardening.ts`, change:

```ts
/** Minimum iOS version (default: '16.0') */
minimumOSVersion?: string;
```

to:

```ts
/** Minimum iOS version (default: '16.4') */
minimumOSVersion?: string;
```

and change:

```ts
minimumOSVersion = '16.0',
```

to:

```ts
minimumOSVersion = '16.4',
```

Make the same runtime-default change in `apps/mobile-admin/plugins/with-ios-release-hardening.js`:

```js
minimumOSVersion = '16.4',
```

Also add Expo's required SDK 56 splash-screen config plugin to the admin plugin list. Change:

```ts
plugins: [
  'expo-router',
  'expo-secure-store',
```

to:

```ts
plugins: [
  'expo-router',
  'expo-splash-screen',
  'expo-secure-store',
```

- [ ] **Step 2: Update mobile-storefront Expo build properties**

Modify `apps/mobile-storefront/app.config.ts`.

Add Expo's required SDK 56 splash-screen config plugin to the storefront plugin list. Change:

```ts
plugins: [
  'expo-router',
  'expo-secure-store',
```

to:

```ts
plugins: [
  'expo-router',
  'expo-splash-screen',
  'expo-secure-store',
```

Change:

```ts
[
  'expo-build-properties',
  {
    ios: {
      useFrameworks: 'static',
    },
  },
],
```

to:

```ts
[
  'expo-build-properties',
  {
    android: {
      compileSdkVersion: 36,
      targetSdkVersion: 36,
      buildToolsVersion: '36.0.0',
    },
    ios: {
      deploymentTarget: '16.4',
      useFrameworks: 'static',
    },
  },
],
```

- [ ] **Step 3: Verify config output sees iOS 16.4**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
pnpm --dir apps/mobile-admin exec expo config --json > /tmp/baci-admin-sdk56-config.json
pnpm --dir apps/mobile-storefront exec expo config --json > /tmp/baci-storefront-sdk56-config.json
node -e 'const a=require("/tmp/baci-admin-sdk56-config.json"); const s=require("/tmp/baci-storefront-sdk56-config.json"); console.log(a.plugins); console.log(s.plugins);'
if rg -n "minimumOSVersion: '15\\.1'|deploymentTarget: '15\\.1'" apps/mobile-admin/app.config.ts apps/mobile-storefront/app.config.ts; then exit 1; fi
if rg -n "minimumOSVersion = '16\\.0'|default: '16\\.0'" apps/mobile-admin/plugins; then exit 1; fi
```

Expected:

```text
Config output includes expo-build-properties with ios.deploymentTarget 16.4 for both apps.
The iOS 15.1 app-config check exits 0, meaning no stale app-config deployment target references were found.
The admin iOS hardening plugin default is 16.4, not 16.0.
Both dynamic Expo configs include the `expo-splash-screen` plugin because Expo CLI cannot auto-write that plugin into `app.config.ts`.
Generated native iOS project files may still show 15.1 until Task 7 runs `expo prebuild --clean`.
```

- [ ] **Step 4: Rename and update SDK compliance tests**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
git mv apps/mobile-admin/__tests__/config/sdk55-compliance.test.ts apps/mobile-admin/__tests__/config/sdk56-compliance.test.ts
git mv apps/mobile-storefront/__tests__/config/sdk55-compliance.test.ts apps/mobile-storefront/__tests__/config/sdk56-compliance.test.ts
```

In both renamed files, change:

```ts
describe('SDK 55 compliance', () => {
```

to:

```ts
describe('SDK 56 compliance', () => {
```

In both renamed files, change test descriptions that say:

```ts
it('app.config.ts does not contain newArchEnabled (removed in SDK 55)', () => {
```

to:

```ts
it('app.config.ts does not contain an explicit newArchEnabled override', () => {
```

In `apps/mobile-admin/__tests__/config/sdk56-compliance.test.ts`, also change:

```ts
it('package.json does not contain expo-av (removed in SDK 55)', () => {
```

to:

```ts
it('package.json does not contain expo-av', () => {
```

In `apps/mobile-admin/__tests__/config/sdk56-compliance.test.ts`, add this test after the `newArchEnabled` test:

```ts
it('sets SDK 56 iOS deployment settings to 16.4', () => {
  const configSource = readFileSync(
    path.join(ROOT, 'app.config.ts'),
    'utf-8'
  );

  expect(configSource).toContain("deploymentTarget: '16.4'");
  expect(configSource).toContain("minimumOSVersion: '16.4'");
  expect(configSource).not.toContain("minimumOSVersion: '15.1'");
});
```

Also add this admin plugin regression test in the same file:

```ts
it('defaults the admin iOS hardening plugin to the SDK 56 iOS floor', () => {
  const pluginSource = readFileSync(
    path.join(ROOT, 'plugins/with-ios-release-hardening.ts'),
    'utf-8'
  );
  const pluginRuntimeSource = readFileSync(
    path.join(ROOT, 'plugins/with-ios-release-hardening.js'),
    'utf-8'
  );

  expect(pluginSource).toContain("minimumOSVersion = '16.4'");
  expect(pluginSource).not.toContain("default: '16.0'");
  expect(pluginRuntimeSource).toContain("minimumOSVersion = '16.4'");
  expect(pluginRuntimeSource).not.toContain("minimumOSVersion = '16.0'");
});
```

In `apps/mobile-storefront/__tests__/config/sdk56-compliance.test.ts`, add this test after the `newArchEnabled` test:

```ts
it('sets SDK 56 iOS deployment target to 16.4', () => {
  const configSource = readFileSync(
    path.join(ROOT, 'app.config.ts'),
    'utf-8'
  );

  expect(configSource).toContain("deploymentTarget: '16.4'");
  expect(configSource).not.toContain("deploymentTarget: '15.1'");
});
```

Then run:

```bash
pnpm --filter baci-mobile-admin test __tests__/config/sdk56-compliance.test.ts
pnpm --filter @baci/mobile-storefront exec jest __tests__/config/sdk56-compliance.test.ts --runInBand --forceExit
```

Expected:

```text
Both renamed SDK 56 compliance test files pass and no test name still says SDK 55.
```

- [ ] **Step 5: Remove tracked stale backup/build artifacts that conflict with SDK 56 scans**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
git rm 'apps/mobile-admin/app/(admin)/payout-settings.tsx.orig'
git rm apps/mobile-admin/app.json.backup
git rm apps/mobile-storefront/raw_build.log
```

Expected:

```text
Tracked backup/log artifacts are removed so deprecated icon imports, old newArchEnabled backup config, and old iOS 15.1 build logs cannot satisfy or fail the SDK 56 migration scans.
```

---

## Phase Review Gate 1: Dependencies, Overrides, And iOS Policy

- [ ] **Step 1: Refresh live Expo metadata**

Run the live metadata refresh from `Execution Model And Phase Review Gates`.

Expected:

```text
The metadata still agrees with the dependency versions selected in Task 2 and the iOS 16.4 policy implemented in Task 3.
```

- [ ] **Step 2: Compare the changed package and config diff against Expo docs**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
git diff -- package.json pnpm-lock.yaml apps/mobile-admin/package.json apps/mobile-storefront/package.json apps/mobile-admin/app.config.ts apps/mobile-storefront/app.config.ts apps/mobile-admin/plugins/with-ios-release-hardening.ts apps/mobile-admin/plugins/with-ios-release-hardening.js
pnpm --dir apps/mobile-admin exec expo install --check
pnpm --dir apps/mobile-storefront exec expo install --check
```

Review:

```text
https://docs.expo.dev/versions/latest/
https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
```

Expected:

```text
Package diffs match the live SDK 56 dependency matrix.
Root overrides do not pin stale SDK 55 native packages.
Both app configs use Android compile/target SDK 36 and iOS deployment target 16.4.
Both app configs include the Expo SDK 56-required `expo-splash-screen` config plugin.
The admin iOS hardening plugin default is 16.4.
expo install --check exits 0 for both apps.
```

- [ ] **Step 3: Step-back decision**

Append a short gate note to `docs/superpowers/reviews/2026-05-21-expo-sdk-56-phase-gates.md` before continuing:

```text
Gate 1 result:
- Docs checked:
- Live metadata:
- Dependency/config mismatch found:
- Plan/code changes made before proceeding:
```

Expected:

```text
Icon, navigation, and file-system migrations do not start until dependency/config drift is resolved.
```

## Task 4: Migrate `@expo/vector-icons`

- [ ] **Step 1: Run the RNVI codemod for mobile-admin using static imports**

The RNVI codemod refuses to run in a dirty git worktree. By this point the isolated worktree is intentionally dirty from the SDK/package/config edits, so use `GIT_CEILING_DIRECTORIES` to make each app directory look like a non-git directory while the two app-specific codemods run sequentially. Do not use this workaround in the original dirty checkout.

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
git status --short
node -e 'const fs=require("node:fs"); const os=require("node:os"); const path=require("node:path"); fs.rmSync(path.join(os.tmpdir(),"rnvi-codemod-new-imports.txt"), { force: true });'
GIT_CEILING_DIRECTORIES=/Users/mac/Baci-expo-sdk-56/apps pnpm dlx @react-native-vector-icons/codemod@13.2.1 --static apps/mobile-admin
```

Expected:

```text
The status output contains only changes produced by Tasks 2 and 3 in the isolated worktree.
apps/mobile-admin/package.json removes @expo/vector-icons.
apps/mobile-admin/package.json adds @react-native-vector-icons/ionicons and @react-native-vector-icons/fontawesome.
Imports in apps/mobile-admin are rewritten to @react-native-vector-icons/*/static.
```

- [ ] **Step 2: Run the RNVI codemod for mobile-storefront using static imports**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
node -e 'const fs=require("node:fs"); const os=require("node:os"); const path=require("node:path"); fs.rmSync(path.join(os.tmpdir(),"rnvi-codemod-new-imports.txt"), { force: true });'
GIT_CEILING_DIRECTORIES=/Users/mac/Baci-expo-sdk-56/apps pnpm dlx @react-native-vector-icons/codemod@13.2.1 --static apps/mobile-storefront
```

Expected:

```text
apps/mobile-storefront/package.json removes @expo/vector-icons.
apps/mobile-storefront/package.json adds @react-native-vector-icons/ionicons, @react-native-vector-icons/fontawesome, and @react-native-vector-icons/feather.
Imports in apps/mobile-storefront are rewritten to @react-native-vector-icons/*/static.
```

- [ ] **Step 3: Register static icon font config plugins**

Modify `apps/mobile-admin/app.config.ts` plugin list so it includes these entries near the other native plugins:

```ts
'@react-native-vector-icons/ionicons',
'@react-native-vector-icons/fontawesome',
```

Modify `apps/mobile-storefront/app.config.ts` plugin list so it includes these entries near the other native plugins:

```ts
'@react-native-vector-icons/ionicons',
'@react-native-vector-icons/fontawesome',
'@react-native-vector-icons/feather',
```

- [ ] **Step 4: Remove old root icon font preloads**

Modify `apps/mobile-admin/app/_layout.tsx`.

Remove these imports if they remain after the codemod:

```ts
import Ionicons from '@react-native-vector-icons/ionicons/static';
import FontAwesome from '@react-native-vector-icons/fontawesome/static';
```

Remove these font entries from the `useFonts` object:

```ts
...FontAwesome.font,
...Ionicons.font,
```

Modify `apps/mobile-storefront/app/_layout.tsx` the same way.

Expected root `useFonts` behavior:

```ts
const [loaded, error] = useFonts({
  SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black,
});
```

For mobile-admin, keep only the Inter font entries in the `useFonts` object.

- [ ] **Step 5: Repair type-only icon imports**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
if rg -n "import .*@expo/vector-icons|import type .*@expo/vector-icons|Ionicons\\.font|FontAwesome\\.font|Ionicons\\.glyphMap|Feather\\.glyphMap|from ['\"]@react-native-vector-icons/(ionicons|fontawesome|feather)['\"];" apps/mobile-admin apps/mobile-storefront --glob '!**/*.test.*' --glob '!**/__tests__/**' --glob '!**/jest.setup.ts' --glob '!**/node_modules/**' --glob '!**/ios/**' --glob '!**/android/**'; then exit 1; fi
```

Expected:

```text
No app/source @expo/vector-icons imports remain.
No Ionicons.font or FontAwesome.font references remain.
Value imports use /static.
No code references Ionicons.glyphMap or Feather.glyphMap; RNVI 13 components do not expose a glyphMap static property.
Type-only icon-name files use exported RNVI name types.
Test/setup mocks may still reference @expo/vector-icons until Step 6.
```

If a type-only file still has this old import:

```ts
import type { Ionicons } from '@expo/vector-icons';
```

replace it and any `keyof typeof Ionicons.glyphMap` usage with:

```ts
import type { IoniconsIconName } from '@react-native-vector-icons/ionicons/static';

type SomeIconName = IoniconsIconName;
```

If a value file needs both the component and the name type, use:

```ts
import Ionicons, {
  type IoniconsIconName,
} from '@react-native-vector-icons/ionicons/static';
```

If a Feather file has `keyof typeof Feather.glyphMap`, replace it with:

```ts
import Feather, {
  type FeatherIconName,
} from '@react-native-vector-icons/feather/static';
```

- [ ] **Step 6: Repair icon test mocks**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
rg -n "mock\\(['\"]@expo/vector-icons|@expo/vector-icons" apps/mobile-admin apps/mobile-storefront --glob '**/*.test.*' --glob '**/__tests__/**' --glob 'jest.setup.ts' --glob '!**/node_modules/**' --glob '!**/ios/**' --glob '!**/android/**'
```

Expected before edits:

```text
The current repo has many test mocks that point at @expo/vector-icons; each one must move to the specific RNVI package path used by the migrated component import.
```

For Jest storefront setup, replace the old global mock in `apps/mobile-storefront/jest.setup.ts`:

```ts
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));
```

with package-specific default-export mocks:

```ts
jest.mock('@react-native-vector-icons/ionicons/static', () => ({
  __esModule: true,
  default: 'Ionicons',
  Ionicons: 'Ionicons',
}));

jest.mock('@react-native-vector-icons/fontawesome/static', () => ({
  __esModule: true,
  default: 'FontAwesome',
  FontAwesome: 'FontAwesome',
}));

jest.mock('@react-native-vector-icons/feather/static', () => ({
  __esModule: true,
  default: 'Feather',
  Feather: 'Feather',
}));
```

For local Jest or Vitest mocks that currently mock `@expo/vector-icons`, replace the module path and export shape to match the migrated import. Example for an Ionicons-only Vitest test:

```ts
vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  __esModule: true,
  default: () => null,
  Ionicons: () => null,
}));
```

Example for an Ionicons-only Jest test:

```ts
jest.mock('@react-native-vector-icons/ionicons/static', () => ({
  __esModule: true,
  default: 'Ionicons',
  Ionicons: 'Ionicons',
}));
```

Example for a mixed Feather/Ionicons test:

```ts
jest.mock('@react-native-vector-icons/ionicons/static', () => ({
  __esModule: true,
  default: 'Ionicons',
  Ionicons: 'Ionicons',
}));

jest.mock('@react-native-vector-icons/feather/static', () => ({
  __esModule: true,
  default: 'Feather',
  Feather: 'Feather',
}));
```

In `apps/mobile-admin/vitest.config.ts`, remove the old externalization:

```ts
/@expo\/vector-icons/,
```

If RNVI static packages need explicit handling in Vitest, use package-specific mocks in the affected tests instead of keeping the removed Expo package externalized.

In `apps/mobile-storefront/jest.config.js`, update `transformIgnorePatterns` so static RNVI packages can be transformed with the rest of React Native packages. Change the start of the allowlist from:

```js
'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo
```

to:

```js
'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-vector-icons/.*)|expo
```

Keep the existing `@react-navigation/.*` transform allowlist because Expo Router may still load React Navigation packages transitively even after direct app-code imports move to `expo-router/react-navigation`.

Then run:

```bash
if rg -n "@expo/vector-icons" apps/mobile-admin apps/mobile-storefront --glob '!**/node_modules/**' --glob '!**/ios/**' --glob '!**/android/**'; then exit 1; fi
```

Expected:

```text
No @expo/vector-icons references remain in app code, tests, setup files, or mocks.
```

- [ ] **Step 7: Install and typecheck the icon migration**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
pnpm install
pnpm --filter baci-mobile-admin typecheck
pnpm --filter @baci/mobile-storefront typecheck
```

Expected:

```text
Both typecheck commands exit 0.
```

---

## Task 5: Migrate Expo Router / React Navigation Imports

- [ ] **Step 1: Run Expo Router migration codemod**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56/apps/mobile-admin
pnpm dlx expo-codemod sdk-56-expo-router-react-navigation-replace .
cd /Users/mac/Baci-expo-sdk-56/apps/mobile-storefront
pnpm dlx expo-codemod sdk-56-expo-router-react-navigation-replace .
```

Expected:

```text
The Expo codemod rewrites @react-navigation/* imports to Expo Router entry points where it has a mapping.
The codemod may print a manual-migration warning for @react-navigation/native-stack in CompactStackHeader.tsx; handle that in Step 3 by deleting the unused component.
```

- [ ] **Step 2: Manually replace ThemeProvider imports**

Modify `apps/mobile-admin/app/_layout.tsx`.

If the codemod leaves the original import:

```ts
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
```

or rewrites those names to the root `expo-router` entry point, normalize the theme import to the SDK 56 migration-guide entry point:

```ts
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from 'expo-router/react-navigation';
```

Modify `apps/mobile-storefront/components/navigation/RootLayoutNav.tsx` the same way. Keep the theme imports in these two files on `expo-router/react-navigation` so the application code and test mocks use the same module specifier.

- [ ] **Step 3: Replace focus imports and remove unused native-stack surface**

Modify `apps/mobile-storefront/components/storefront/ProductGrid.tsx`.

Replace the original import:

```ts
import { useIsFocused } from '@react-navigation/native';
```

or, if the codemod rewrites it to the root `expo-router` entry point, normalize it to:

```ts
import { useIsFocused } from 'expo-router/react-navigation';
```

Do not replace `@react-navigation/native-stack` with `expo-router/react-navigation`. Expo's SDK 56 codemod marks `@react-navigation/native-stack` as unsupported because there is no direct re-export. In this repo, `CompactStackHeader` is not imported by runtime code, so remove the dead surface instead:

```bash
cd /Users/mac/Baci-expo-sdk-56
rm apps/mobile-storefront/components/navigation/CompactStackHeader.tsx
rm apps/mobile-storefront/components/navigation/CompactStackHeader.test.tsx
```

Then modify `apps/mobile-storefront/components/navigation/RootLayoutNav.test.tsx` and remove this stale mock block if it still exists:

```ts
jest.mock('@/components/navigation/CompactStackHeader', () => ({
  CompactStackHeader: () => null,
}));
```

- [ ] **Step 4: Update tests and Jest transform allowlist**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
rg -n "@react-navigation/" apps/mobile-admin apps/mobile-storefront --glob '!**/node_modules/**' --glob '!**/ios/**' --glob '!**/android/**' --glob '!**/package.json'
```

For remaining storefront mocks such as:

```ts
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));
```

replace the mocked module path with:

```ts
jest.mock('expo-router/react-navigation', () => ({
  useIsFocused: () => true,
}));
```

Apply this replacement specifically in:

```text
apps/mobile-storefront/components/navigation/RootLayoutNav.test.tsx
apps/mobile-storefront/components/storefront/ProductGrid.test-utils.tsx
```

Do not remove the existing `@react-navigation/.*` Jest transform allowlist solely because app-code imports moved; Expo Router can still load React Navigation packages transitively.

Expected:

```text
No application source imports from @react-navigation/* remain.
The rg command may still show apps/mobile-storefront/jest.config.js for the retained transform allowlist.
No CompactStackHeader references remain.
```

- [ ] **Step 5: Remove direct React Navigation dependencies and typecheck navigation migration**

If `rg` shows no application or test imports from `@react-navigation/native`, remove direct dependencies from both mobile app package files:

```bash
cd /Users/mac/Baci-expo-sdk-56
pnpm --filter baci-mobile-admin remove @react-navigation/native
pnpm --filter @baci/mobile-storefront remove @react-navigation/native
pnpm install
```

Do not remove transitive React Navigation packages from `pnpm-lock.yaml` manually; Expo Router owns its internal dependencies.

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
pnpm --filter baci-mobile-admin typecheck
pnpm --filter @baci/mobile-storefront typecheck
```

Expected:

```text
Both typecheck commands exit 0.
```

---

## Task 6: Audit `expo-file-system` Behavior

- [ ] **Step 1: Inspect known file-system call sites**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
rg -n "expo-file-system|\\.move\\(|\\.copy\\(|downloadFileAsync|createDownloadTask|createUploadTask|pickFileAsync" apps/mobile-admin apps/mobile-storefront --glob '!**/node_modules/**' --glob '!**/ios/**' --glob '!**/android/**'
```

Expected known app-owned files:

```text
apps/mobile-admin/hooks/useCachedImageUri.ts
apps/mobile-admin/hooks/createOrderDetailsReceiptActions.ts
apps/mobile-admin/utils/order-export/loadOrderExportNativeModules.ts
apps/mobile-admin/hooks/createOrderDetailsReceiptActions.test.ts
apps/mobile-admin/utils/order-export/loadOrderExportNativeModules.test.ts
apps/mobile-storefront/lib/utility-receipt.ts
apps/mobile-storefront/lib/utility-receipt.test.ts
```

- [ ] **Step 2: Make move/copy overwrite behavior explicit**

`expo-file-system@56.0.7` exposes `File.move(destination, options?: { overwrite?: boolean }): Promise<void>`, so await the receipt PDF move and make overwrite behavior explicit.

In `apps/mobile-admin/hooks/createOrderDetailsReceiptActions.ts`, change:

```ts
sourceFile.move(destinationFile);
```

to:

```ts
await sourceFile.move(destinationFile, { overwrite: true });
```

In `apps/mobile-admin/hooks/createOrderDetailsReceiptActions.test.ts`, update the mock signature:

```ts
async move(destination: { uri?: string } | string, _options?: { overwrite?: boolean }) {
  this.uri =
    typeof destination === 'string'
      ? destination
      : (destination.uri ?? this.uri);
}
```

- [ ] **Step 3: Run focused file-system tests**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
pnpm --filter baci-mobile-admin test hooks/createOrderDetailsReceiptActions.test.ts utils/order-export/loadOrderExportNativeModules.test.ts
pnpm --filter @baci/mobile-storefront exec jest lib/utility-receipt.test.ts --runInBand --forceExit
```

Expected:

```text
Both commands exit 0.
```

---

## Phase Review Gate 2: Source Migrations

- [ ] **Step 1: Refresh live Expo metadata**

Run the live metadata refresh from `Execution Model And Phase Review Gates`.

Expected:

```text
The metadata still supports the SDK 56 source migrations already made in Tasks 4, 5, and 6.
```

- [ ] **Step 2: Compare icon, router, and file-system changes against current docs**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
if rg -n "@expo/vector-icons|Ionicons\\.font|FontAwesome\\.font|Ionicons\\.glyphMap|Feather\\.glyphMap|from ['\"]@react-native-vector-icons/(ionicons|fontawesome|feather)['\"];" apps/mobile-admin apps/mobile-storefront --glob '!**/node_modules/**' --glob '!**/ios/**' --glob '!**/android/**'; then exit 1; fi
if rg -n "@react-navigation/native|@react-navigation/native-stack" apps/mobile-admin apps/mobile-storefront --glob '!**/node_modules/**' --glob '!**/ios/**' --glob '!**/android/**' --glob '!**/package.json'; then exit 1; fi
rg -n "expo-file-system|\\.move\\(|\\.copy\\(|downloadFileAsync|createDownloadTask|createUploadTask|pickFileAsync" apps/mobile-admin apps/mobile-storefront --glob '!**/node_modules/**' --glob '!**/ios/**' --glob '!**/android/**'
pnpm --filter baci-mobile-admin typecheck
pnpm --filter @baci/mobile-storefront typecheck
```

Review:

```text
https://docs.expo.dev/router/migrate/sdk-55-to-56/
https://docs.expo.dev/versions/latest/sdk/filesystem/
```

Expected:

```text
No app-code import remains from @react-navigation/*; @react-navigation/native maps to expo-router/react-navigation.
No @react-navigation/native-stack replacement was invented; the unused CompactStackHeader surface is deleted because Expo's migration guide says native-stack has no direct equivalent.
No @expo/vector-icons reference remains; RNVI package-per-family static imports and config plugins are in place.
expo-file-system usage matches the bundled SDK 56 FileSystem reference, including explicit async move behavior where Baci moves generated receipts.
Both mobile app typechecks exit 0.
```

- [ ] **Step 3: Step-back decision**

Append a short gate note to `docs/superpowers/reviews/2026-05-21-expo-sdk-56-phase-gates.md` before continuing:

```text
Gate 2 result:
- Docs checked:
- Live metadata:
- Source migration mismatch found:
- Plan/code changes made before proceeding:
```

Expected:

```text
Native regeneration does not start until icon, navigation, and file-system source drift is resolved.
```

## Task 7: Regenerate Native Projects And Audit Patches

- [ ] **Step 1: Regenerate mobile-admin native projects**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56/apps/mobile-admin
pnpm exec expo prebuild --clean
```

Expected:

```text
ios/ and android/ are regenerated for SDK 56.
app.config.ts plugins apply without errors.
```

- [ ] **Step 2: Regenerate mobile-storefront native projects**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56/apps/mobile-storefront
pnpm exec expo prebuild --clean
```

Expected:

```text
ios/ and android/ are regenerated for SDK 56.
app.config.ts plugins apply without errors.
```

- [ ] **Step 3: Reinstall dependencies after prebuild**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
pnpm install
```

Expected:

```text
pnpm install exits 0.
```

- [ ] **Step 4: Audit stale patch-package entries**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
node - <<'NODE'
const { readFileSync } = require('node:fs');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const patched = pkg.pnpm?.patchedDependencies ?? {};
for (const [target, patchFile] of Object.entries(patched)) {
  console.log(`${target}\t${patchFile}`);
}
NODE
rg -n "^diff --git|^--- |^\\+\\+\\+|55\\.0|0\\.84\\.1|@expo/log-box|expo-dev-launcher|expo-dev-menu|expo-modules|expo-updates|expo@|react-native@" patches package.json
pnpm install
```

Before deleting any patch in this step, use the same classification rule from Task 2: obsolete SDK/RN compatibility shim can be removed, but a Baci-specific local fix for a package that still exists must be rebased to the SDK 56 package version.

Expected:

```text
No patchedDependencies entry points at packages that no longer exist after SDK 56.
If pnpm fails because a patch target no longer resolves and the patch is obsolete, remove that patchedDependencies entry and its patch file.
If pnpm fails because a patch does not apply to an SDK 56 package still needed by the app, rebase the patch to the SDK 56 package version and keep the patch narrow.
No Baci-specific third-party patch is dropped without checking whether the underlying bug still exists in the SDK 56 dependency version.
```

- [ ] **Step 5: Confirm app-owned iOS deployment targets are 16.4**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
if rg -n "IPHONEOS_DEPLOYMENT_TARGET = 15\\.1|platform :ios.*15\\.1|ios.deploymentTarget.*15\\.1|minimumOSVersion: '15\\.1'|minimumOSVersion = '16\\.0'|default: '16\\.0'" apps/mobile-admin apps/mobile-storefront --glob '!**/Pods/**' --glob '!**/__tests__/**' --glob '!**/*.test.*'; then exit 1; fi
rg -n "IPHONEOS_DEPLOYMENT_TARGET = 16\\.4|platform :ios.*16\\.4|ios.deploymentTarget.*16\\.4|minimumOSVersion: '16\\.4'|minimumOSVersion = '16\\.4'" apps/mobile-admin apps/mobile-storefront --glob '!**/Pods/**' --glob '!**/__tests__/**' --glob '!**/*.test.*'
```

Expected:

```text
No app-owned 15.1 deployment target lines remain.
No admin iOS hardening plugin default still points at 16.0.
16.4 deployment target lines exist in app config, the admin hardening plugin default, and regenerated iOS projects.
```

- [ ] **Step 6: Audit Expo upgrade housekeeping without deleting Baci-specific config**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
if rg -n '"sdkVersion"|newArchEnabled|EXPO_USE_FAST_RESOLVER|experimentalImportSupport' package.json apps/mobile-admin apps/mobile-storefront --glob '!**/node_modules/**' --glob '!**/ios/**' --glob '!**/android/**' --glob '!**/__tests__/**' --glob '!**/*.test.*' --glob '!**/jest.setup.ts'; then exit 1; fi
node - <<'NODE'
const { readFileSync } = require('node:fs');
for (const file of [
  'package.json',
  'apps/mobile-admin/package.json',
  'apps/mobile-storefront/package.json',
]) {
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  const excluded = pkg.expo?.install?.exclude ?? [];
  if (excluded.length > 0) {
    console.error(`${file} has expo.install.exclude: ${excluded.join(', ')}`);
    process.exitCode = 1;
  }
}
NODE
rg -n "from ['\"]expo-constants|require\\(['\"]expo-constants" apps/mobile-admin apps/mobile-storefront --glob '!**/*.test.*' --glob '!**/__tests__/**' --glob '!**/node_modules/**' --glob '!**/ios/**' --glob '!**/android/**'
sed -n '1,140p' apps/mobile-admin/babel.config.js apps/mobile-storefront/babel.config.js
sed -n '1,160p' apps/mobile-admin/metro.config.js apps/mobile-storefront/metro.config.js
```

Expected:

```text
No sdkVersion, newArchEnabled, expo.install.exclude, EXPO_USE_FAST_RESOLVER, or experimentalImportSupport source/config setting remains. SDK compliance tests may still mention those strings because they assert absence.
expo-constants is kept as a direct dependency because Baci imports it at runtime.
Babel configs are not default-only configs; keep the React Compiler, Reanimated, NativeWind, module-resolver, and test dynamic-import settings unless a gate proves they are stale.
Metro configs are not default-only configs; keep the pnpm monorepo resolver, SVG transformer, shared package aliasing, and blockList settings unless a gate proves they are stale. SDK 56 Gate 1 removed the stale `resolver.unstable_enableSymlinks` flag because current Expo monorepo guidance says SDK 52+ automatically configures Metro for monorepos when using `expo/metro-config`.
unstable_enablePackageExports may remain only as part of the documented monorepo resolver config; do not delete the custom Metro files just because Expo enables package exports by default.
```

---

## Phase Review Gate 3: Native Regeneration And Upgrade Housekeeping

- [ ] **Step 1: Refresh live Expo metadata**

Run the live metadata refresh from `Execution Model And Phase Review Gates`.

Expected:

```text
The metadata still agrees with the regenerated native project settings and installed native package versions.
```

- [ ] **Step 2: Compare native and patch diff against Expo docs**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
git diff --stat apps/mobile-admin/ios apps/mobile-admin/android apps/mobile-storefront/ios apps/mobile-storefront/android patches package.json pnpm-lock.yaml
if rg -n "IPHONEOS_DEPLOYMENT_TARGET = 15\\.1|platform :ios.*15\\.1|ios.deploymentTarget.*15\\.1|minimumOSVersion: '15\\.1'|minimumOSVersion = '16\\.0'|default: '16\\.0'" apps/mobile-admin apps/mobile-storefront --glob '!**/Pods/**' --glob '!**/__tests__/**' --glob '!**/*.test.*'; then exit 1; fi
rg -n "IPHONEOS_DEPLOYMENT_TARGET = 16\\.4|platform :ios.*16\\.4|ios.deploymentTarget.*16\\.4|minimumOSVersion: '16\\.4'|minimumOSVersion = '16\\.4'" apps/mobile-admin apps/mobile-storefront --glob '!**/Pods/**' --glob '!**/__tests__/**' --glob '!**/*.test.*'
pnpm --dir apps/mobile-admin exec expo install --check
pnpm --dir apps/mobile-storefront exec expo install --check
pnpm dlx expo-doctor@latest apps/mobile-admin
pnpm dlx expo-doctor@latest apps/mobile-storefront
```

Review:

```text
https://docs.expo.dev/versions/latest/
https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
```

Expected:

```text
Native Android/iOS diffs are attributable to SDK 56 prebuild and app-owned config plugins.
No regenerated native project keeps iOS 15.1 or plugin default 16.0.
Patch-package entries are either rebased to SDK 56 packages or removed only after proving they were obsolete SDK 55/RN 0.84 shims.
expo install --check exits 0 for both apps. expo-doctor exits 0 or reports only the known non-CNG warning caused by source-controlled native folders plus app config native properties; the native folders must have just been regenerated from that config before accepting this warning.
```

- [ ] **Step 3: Step-back decision**

Append a short gate note to `docs/superpowers/reviews/2026-05-21-expo-sdk-56-phase-gates.md` before continuing:

```text
Gate 3 result:
- Docs checked:
- Live metadata:
- Native/patch mismatch found:
- Plan/code changes made before proceeding:
```

Expected:

```text
Static and native build gates do not start until regenerated native drift is explained and fixed.
```

## Task 8: Static Gates

- [ ] **Step 1: Run package drift and Expo diagnostics**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
pnpm --filter baci-mobile-admin check:platform-drift
pnpm --filter @baci/mobile-storefront check:platform-drift
pnpm dlx expo-doctor@latest apps/mobile-admin
pnpm dlx expo-doctor@latest apps/mobile-storefront
```

Expected:

```text
All commands exit 0.
expo-doctor does not report SDK 55 packages or direct React Navigation + Expo Router conflicts.
```

- [ ] **Step 2: Run typecheck, lint, and tests**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
pnpm --filter baci-mobile-admin typecheck
pnpm --filter baci-mobile-admin lint
pnpm --filter baci-mobile-admin test
pnpm --filter @baci/mobile-storefront typecheck
pnpm --filter @baci/mobile-storefront lint
pnpm --filter @baci/mobile-storefront exec jest --runInBand --forceExit
git diff --check
```

Expected:

```text
All commands exit 0.
```

- [ ] **Step 3: Run repo-level gates after focused gates pass**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
```

Expected:

```text
All commands exit 0.
```

---

## Task 9: Native Build Gates

- [ ] **Step 1: Build mobile-admin Android with the supported repo path**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56/apps/mobile-admin/android
./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 2: Build mobile-storefront Android**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56/apps/mobile-storefront/android
./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 3: Install and launch mobile-admin on Android emulator**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
pnpm --filter baci-mobile-admin android:emulator
pnpm --filter baci-mobile-admin android:install
rm -f /tmp/baci-admin-metro.log /tmp/baci-admin-metro.pid
(pnpm --filter baci-mobile-admin android:metro > /tmp/baci-admin-metro.log 2>&1 & echo $! > /tmp/baci-admin-metro.pid)
sleep 10
pnpm --filter baci-mobile-admin android:launch
tail -n 80 /tmp/baci-admin-metro.log
```

Expected:

```text
The repository launcher starts the configured emulator, installs the app, starts Metro through the supported LAN host, and launches the dev client without a redbox. Keep the Metro process alive through Task 10 Step 1, then stop it before starting storefront Metro.
```

- [ ] **Step 4: Install Pods and build mobile-admin iOS**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56/apps/mobile-admin/ios
pod install --repo-update
xcodebuild -workspace Baci.xcworkspace -scheme Baci -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Expected:

```text
xcodebuild exits 0.
No SDK 55 pod or iOS 15.1 deployment target errors remain.
```

- [ ] **Step 5: Install Pods and build mobile-storefront iOS**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56/apps/mobile-storefront/ios
pod install --repo-update
xcodebuild -workspace Ogabassey.xcworkspace -scheme Ogabassey -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Expected:

```text
xcodebuild exits 0.
No SDK 55 pod or iOS 15.1 deployment target errors remain.
```

---

## Task 10: Visual And Runtime Smoke Tests

- [ ] **Step 1: Confirm icons render in high-traffic screens**

Use the running mobile-admin dev client from Task 9. If it was closed, relaunch it without starting a second Metro process:

```bash
cd /Users/mac/Baci-expo-sdk-56
pnpm --filter baci-mobile-admin android:launch
```

Inspect:

```text
Login screen
Dashboard tabs
Orders tab
Settings tab
Product editor
Order details
Admin auth redirect
Admin nested order/product back navigation
```

Expected:

```text
Ionicons and FontAwesome glyphs are visible, not tofu boxes or blank squares.
No runtime warning says an icon font failed to load.
```

After the admin smoke is complete, stop the Metro process from Task 9 so storefront Metro can bind its default port:

```bash
if [ -f /tmp/baci-admin-metro.pid ]; then
  kill "$(cat /tmp/baci-admin-metro.pid)" 2>/dev/null || true
  rm -f /tmp/baci-admin-metro.pid
fi
```

- [ ] **Step 2: Confirm storefront icons render in high-traffic screens**

Start mobile-storefront in a separate Metro session, then launch the Android dev build:

```bash
cd /Users/mac/Baci-expo-sdk-56
rm -f /tmp/baci-storefront-metro.log /tmp/baci-storefront-metro.pid
(pnpm --filter @baci/mobile-storefront start > /tmp/baci-storefront-metro.log 2>&1 & echo $! > /tmp/baci-storefront-metro.pid)
sleep 10
pnpm --filter @baci/mobile-storefront android
tail -n 80 /tmp/baci-storefront-metro.log
```

Inspect:

```text
Home tab
Product detail
Cart
Checkout
Orders list
Settings/profile
Filter bar and footer, because these use Feather
```

Expected:

```text
Ionicons, FontAwesome, and Feather glyphs are visible.
No screen has blank icon placeholders.
```

- [ ] **Step 3: Confirm navigation still works after Expo Router migration**

Exercise:

```text
Storefront auth redirect
Storefront tabs
Storefront product/category/search navigation
Storefront native stack back button and route headers
```

Expected:

```text
Back navigation works.
Header theme colors still follow the existing light/dark theme.
No direct @react-navigation import error appears in Metro.
```

After the storefront smoke is complete, stop the Metro process:

```bash
if [ -f /tmp/baci-storefront-metro.pid ]; then
  kill "$(cat /tmp/baci-storefront-metro.pid)" 2>/dev/null || true
  rm -f /tmp/baci-storefront-metro.pid
fi
```

- [ ] **Step 4: Record visual-improvement follow-ups separately**

Create a short follow-up note in the PR description, not in this upgrade diff:

```text
SDK 56 follow-up candidates:
- Replace @react-native-community/datetimepicker with Expo UI DateTimePicker only after the SDK upgrade lands.
- Evaluate Expo UI BottomSheet for admin modal/sheet surfaces in a separate UI PR.
- Evaluate status/navigation bar cleanup in the most visible storefront checkout and admin order flows.
```

Expected:

```text
The SDK upgrade PR does not include broad UI rewrites.
```

---

## Phase Review Gate 4: Verification Evidence And Release Readiness

- [ ] **Step 1: Refresh live Expo metadata**

Run the live metadata refresh from `Execution Model And Phase Review Gates`.

Expected:

```text
The final verification evidence still targets the current SDK 56 matrix. If Expo latest moved beyond SDK 56 during implementation, record that explicitly in the PR and confirm the decision to ship SDK 56 anyway.
```

- [ ] **Step 2: Compare all verification evidence against Expo docs**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
pnpm --filter baci-mobile-admin check:platform-drift
pnpm --filter @baci/mobile-storefront check:platform-drift
pnpm --dir apps/mobile-admin exec expo install --check
pnpm --dir apps/mobile-storefront exec expo install --check
pnpm dlx expo-doctor@latest apps/mobile-admin
pnpm dlx expo-doctor@latest apps/mobile-storefront
git diff --stat
git diff --check
```

Review:

```text
https://docs.expo.dev/versions/latest/
https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
https://docs.expo.dev/router/migrate/sdk-55-to-56/
https://docs.expo.dev/versions/latest/sdk/filesystem/
```

Expected:

```text
The final evidence covers Expo's documented upgrade requirements, SDK 56 platform floors, Router import migration, FileSystem API usage, Android builds, iOS builds, and runtime icon/navigation smoke tests.
The PR body mentions any deliberate decision to remain pinned to SDK 56 if live npm metadata has moved.
No broad visual redesign is included.
```

- [ ] **Step 3: Step-back decision**

Append a short gate note to `docs/superpowers/reviews/2026-05-21-expo-sdk-56-phase-gates.md` before final PR prep:

```text
Gate 4 result:
- Docs checked:
- Live metadata:
- Verification/release-readiness mismatch found:
- Plan/code changes made before proceeding:
```

Expected:

```text
Final review and PR prep do not start until all verification gaps are closed or explicitly documented as release blockers.
```

## Task 11: Final Review And PR Prep

- [ ] **Step 1: Confirm no deprecated imports remain**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
if rg -n "@expo/vector-icons|@react-navigation/native|@react-navigation/native-stack|Ionicons\\.font|FontAwesome\\.font|Ionicons\\.glyphMap|Feather\\.glyphMap|from ['\"]@react-native-vector-icons/(ionicons|fontawesome|feather)['\"];" apps/mobile-admin apps/mobile-storefront package.json --glob '!**/Pods/**' --glob '!**/ios/**' --glob '!**/android/**'; then exit 1; fi
if rg -n "minimumOSVersion: '15\\.1'|deploymentTarget: '15\\.1'|IPHONEOS_DEPLOYMENT_TARGET = 15\\.1|platform :ios.*15\\.1|ios15\\.1|minimumOSVersion = '16\\.0'|default: '16\\.0'" apps/mobile-admin/app.config.ts apps/mobile-admin/plugins apps/mobile-storefront/app.config.ts apps/mobile-admin/ios apps/mobile-storefront/ios --glob '!**/Pods/**' --glob '!**/build/**'; then exit 1; fi
if rg -n "@expo/vector-icons" pnpm-lock.yaml; then exit 1; fi
pnpm --dir apps/mobile-admin exec expo install --check
pnpm --dir apps/mobile-storefront exec expo install --check
for app in baci-mobile-admin @baci/mobile-storefront; do
  echo "Installed native package versions for $app"
  pnpm --filter "$app" exec node - <<'NODE'
const packages = [
  'react-native-worklets',
  'react-native-reanimated',
  'react-native-screens',
  'react-native-safe-area-context',
  'react-native-svg',
];
for (const packageName of packages) {
  try {
    const version = require(`${packageName}/package.json`).version;
    console.log(`${packageName}\t${version}`);
  } catch {
    console.log(`${packageName}\tMISSING`);
  }
}
NODE
done
if git ls-files | rg "sdk55-compliance|raw_build\\.log|app\\.json\\.backup|payout-settings\\.tsx\\.orig"; then exit 1; fi
if rg -n "SDK 55|sdk55-compliance" apps/mobile-admin/__tests__/config apps/mobile-storefront/__tests__/config; then exit 1; fi
```

Expected:

```text
No @expo/vector-icons imports remain.
No app-code @react-navigation/native or @react-navigation/native-stack imports remain.
No icon .font preload references remain.
No icon .glyphMap type references remain.
No non-static RNVI icon imports remain.
No app-owned iOS 15.1 references remain.
No admin iOS hardening plugin default still points at iOS 16.0.
No @expo/vector-icons package remains in pnpm-lock.yaml.
Expo package checks still pass after root override and patch-package cleanup.
Installed native package versions printed from both app contexts match the SDK 56-compatible dependency graph.
No tracked SDK 55 compliance test filenames or tracked raw build/backup artifacts remain.
Transitive @react-navigation packages may remain in pnpm-lock.yaml through Expo Router and should not be removed manually.
```

- [ ] **Step 2: Review dependency and native diff size**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
git status --short
git diff --stat
git diff -- package.json apps/mobile-admin/package.json apps/mobile-storefront/package.json
git diff -- apps/mobile-admin/app.config.ts apps/mobile-storefront/app.config.ts
```

Expected:

```text
Diff is large because native projects and icon imports changed.
Dependency diff clearly shows Expo SDK 56, React Native 0.85.x, RNVI packages, and removed @expo/vector-icons.
```

- [ ] **Step 3: Run CodeRabbit prompt-only review before commit**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
coderabbit review --prompt-only -t uncommitted
```

Expected:

```text
No critical or high severity finding remains unresolved, or the CodeRabbit limitation is recorded if the diff/file limit or org usage limit blocks review.
```

- [ ] **Step 4: Commit remaining changes**

Run:

```bash
cd /Users/mac/Baci-expo-sdk-56
git add package.json pnpm-lock.yaml docs/superpowers/plans/2026-05-21-expo-sdk-56-full-mobile-upgrade.md docs/superpowers/reviews/2026-05-21-expo-sdk-56-phase-gates.md apps/mobile-admin apps/mobile-storefront patches
git status --short
git commit -m "chore: upgrade mobile apps to Expo SDK 56"
```

Expected:

```text
Final upgrade commit succeeds on codex/expo-sdk-56-mobile-upgrade after verification gates pass and any CodeRabbit limitation is explicitly recorded.
```

- [ ] **Step 5: Push and open PR**

Run:

````bash
cd /Users/mac/Baci-expo-sdk-56
cat > /tmp/baci-expo-sdk-56-pr.md <<'EOF'
## Summary
- upgrade mobile-admin and mobile-storefront to Expo SDK 56 / React Native 0.85
- migrate @expo/vector-icons to @react-native-vector-icons package-per-family static imports
- migrate Expo Router app-code imports away from @react-navigation/*
- raise iOS deployment target to 16.4 and regenerate native projects
- audit root native-package overrides, patch-package entries, and mobile native build gates
- complete inline phase review gates against current Expo docs, npm metadata, and the Expo versions endpoint

## Release note
- This drops iOS 15 support for new app updates. Keep the final SDK 55 build available as the App Store last-compatible version for iOS 15 users.

## Phase review gates
- Full gate notes are committed in `docs/superpowers/reviews/2026-05-21-expo-sdk-56-phase-gates.md`.
- Gate 0: Baseline and SDK target checked against Expo SDK reference and upgrade walkthrough.
- Gate 1: Dependency, override, and iOS policy diff checked against live SDK 56 metadata.
- Gate 2: Icon, Expo Router, and FileSystem source migrations checked against current Expo docs.
- Gate 3: Native regeneration, patch-package cleanup, and Expo housekeeping checked against current Expo docs.
- Gate 4: Final verification evidence and release readiness checked against current Expo docs.

## Follow-up candidates
- Replace @react-native-community/datetimepicker with Expo UI DateTimePicker only after the SDK upgrade lands.
- Evaluate Expo UI BottomSheet for admin modal/sheet surfaces in a separate UI PR.
- Evaluate status/navigation bar cleanup in the most visible storefront checkout and admin order flows.

## Verification
- pnpm --filter baci-mobile-admin check:platform-drift
- pnpm --filter @baci/mobile-storefront check:platform-drift
- pnpm --dir apps/mobile-admin exec expo install --check
- pnpm --dir apps/mobile-storefront exec expo install --check
- pnpm dlx expo-doctor@latest apps/mobile-admin
- pnpm dlx expo-doctor@latest apps/mobile-storefront
- pnpm --filter baci-mobile-admin typecheck
- pnpm --filter baci-mobile-admin lint
- pnpm --filter baci-mobile-admin test
- pnpm --filter @baci/mobile-storefront typecheck
- pnpm --filter @baci/mobile-storefront lint
- pnpm --filter @baci/mobile-storefront exec jest --runInBand --forceExit
- pnpm turbo lint
- pnpm turbo typecheck
- pnpm turbo test
- apps/mobile-admin/android ./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain
- apps/mobile-storefront/android ./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain
- apps/mobile-admin/ios xcodebuild -workspace Baci.xcworkspace -scheme Baci -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
- apps/mobile-storefront/ios xcodebuild -workspace Ogabassey.xcworkspace -scheme Ogabassey -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
EOF
git push -u origin codex/expo-sdk-56-mobile-upgrade
gh pr create --base main --head codex/expo-sdk-56-mobile-upgrade --title "Upgrade mobile apps to Expo SDK 56" --body-file /tmp/baci-expo-sdk-56-pr.md
````

Expected:

```text
PR opens against main.
PR body explicitly calls out iOS 15 support impact and keeps visual improvements as follow-up candidates.
```

---

## Self-Review Checklist

- [ ] Plan covers SDK dependency upgrade for both mobile apps.
- [ ] Plan covers iOS 16.4 support policy and App Store last-compatible-version release handling.
- [ ] Plan covers icon package migration, config plugins, root font preload cleanup, type-only icon imports, and Feather.
- [ ] Plan covers Jest/Vitest icon mock migration away from `@expo/vector-icons`.
- [ ] Plan covers Expo Router / React Navigation import migration.
- [ ] Plan handles unsupported `@react-navigation/native-stack` by removing the unused `CompactStackHeader` surface instead of inventing an import path.
- [ ] Plan covers `expo-file-system` known call sites.
- [ ] Plan covers root override drift and Expo upgrade housekeeping for non-default Babel/Metro configs.
- [ ] Plan covers native prebuild, stale patch-package audit, Android builds, iOS builds, unit/static gates, and visual smoke.
- [ ] Plan keeps broad visual redesign out of this upgrade PR and lists follow-up candidates separately.
