# Expo SDK 56 → 57 Upgrade Plan

**Apps:** `apps/mobile-storefront` (lead), `apps/mobile-admin`
**Status:** Draft for review — not yet started
**Date:** 2026-07-01 (rev 2, after review)

---

## TL;DR

Upgrade both Expo apps from **SDK 56 (RN 0.85.3)** to **SDK 57 (RN 0.86, React stays 19.2.3)**, and
enable **react-native-worklets bundle mode on Android** to recover the ~25–30% reanimated memory
cost we already pay on RN 0.85. React unchanged → no breaking JS; the real work is: refresh
version-pinned pnpm patches, validate our **config plugins** against RN 0.86 (release path uses
`expo prebuild --clean`), and compose bundle mode into two custom, order-sensitive Metro configs.

**Lead app:** `mobile-storefront` first (end customers on low-end Android — validate the memory win
where it matters most), then mirror to `mobile-admin`. **Prerequisite:** storefront lacks the Android
launcher scripts admin has — see Phase 0.

---

## Architecture reality (corrected after review)

This is a **hybrid CNG (Continuous Native Generation) setup**, not a pure bare workflow:

- **Release path = config-plugin driven.** All four release workflows run
  `pnpm exec expo prebuild --platform … --clean`
  ([android-storefront](../../.github/workflows/android-storefront-release.yml),
  [ios-storefront](../../.github/workflows/ios-storefront-release.yml),
  [android-admin](../../.github/workflows/android-release.yml),
  [ios-admin](../../.github/workflows/ios-release.yml)). Native projects are **regenerated from
  `app.config.ts` plugins** at build time. The **source of truth for shipped native config is the
  plugin list**, not the committed native dirs.
- **Config plugins in play** (storefront `app.config.ts`): `expo-*` plugins, `expo-build-properties`
  (compile/target SDK 36, iOS deploy target 16.4, static frameworks), `posthog-react-native/expo`,
  and **6 local `./config/with*.js` plugins**: `withFirebaseModularHeaders`, `withObjCLinkerFlag`,
  `withNoSplashImage`, `withAdaptiveAndroidManifest`, `withAndroidSystemBars`, `withAndroidGradleFixes`.
  (Tiktok + facebook are separate *conditional package* plugins, not local `with*.js` files.) The
  posthog native hooks come from the **plugin**, so prebuild does not clobber them.
- **Config plugins in play** (admin `app.config.ts`) — *different set from storefront*:
  `@sentry/react-native/expo` (native), `expo-build-properties`, standard `expo-*` plugins, **2 local
  `./config/with*.js` plugins** (`withAndroidSystemBars`, `withAndroidGradleFixes`), and the local
  **`./plugins/with-ios-release-hardening`** — which mutates the Xcode project via `withXcodeProject`
  plus `withEntitlementsPlist` / `withInfoPlist`
  ([plugin](../../apps/mobile-admin/plugins/with-ios-release-hardening.ts)). Because SDK 57 changes
  prebuild behavior and RN 0.86 changes the pbxproj template, this hardening plugin needs **explicit
  RN-0.86 pbxproj validation** (it's the highest-risk plugin in either app).
- **Committed native dirs are local-dev convenience** — a curated subset (storefront 45 android / 20
  ios files; admin 49 / 24), used by `expo run:android|ios` for local iteration. They are *not* what
  release builds from.

**Implication for this upgrade:** RN 0.86 native template changes flow through prebuild
**automatically**. The risk is that our **local config plugins** assume 0.85 gradle/pbxproj structure
and break on 0.86 prebuild output. So the native validation is: run `expo prebuild --clean` on RN
0.86, confirm each plugin still applies, then confirm native builds. Committed native dirs get
**regenerated** (not hand-diffed) for local-dev parity.

---

## Release-path decision (P1)

**Decision: keep the prebuild-clean release model; do NOT migrate workflows to committed native.**
Rationale: it's already the shipping path, config plugins are the intended abstraction, and migrating
off it is a separate, larger project. Therefore the upgrade's native work targets **config plugins +
prebuild output**, and every native change must be expressed as/verified through a plugin — never
hand-edited only in committed dirs (those get wiped in CI).

Concretely:
- **storefront:** audit the 6 local `./config/with*.js` plugins for RN-0.86 / AGP / Gradle assumptions
  (`withAndroidGradleFixes` most at risk).
- **admin:** audit the 2 local `./config/with*.js` plugins (`withAndroidSystemBars`,
  `withAndroidGradleFixes`), the `@sentry/react-native/expo` native plugin, and especially
  `./plugins/with-ios-release-hardening` against the RN-0.86 pbxproj/entitlements/Info.plist template
  (confirm `withXcodeProject` mutations still apply and archive signs correctly).
- Confirm `expo-build-properties` values (SDK 36, buildTools 36.0.0, iOS 16.4, static frameworks)
  remain valid on 0.86 in **both** apps.
- The `sed` "fix prebuild signing style" step in the iOS workflows must still match the regenerated
  pbxproj — re-verify after upgrade.

---

## Excluded-dependency matrix (P1)

`expo.install.exclude` exists to **hold Baci above the SDK 57 pins** where we deliberately run newer.
SDK 57 pins several *lower* than local — those are keep-local decisions, not "bump to target." Confirm
each SDK 57 target at execution with the app-scoped, pnpm-native command
(`pnpm --dir apps/mobile-storefront exec expo install --check --pnpm`); the numbers below are the
review's findings and must be re-verified.

| Package | Local | SDK 57 target | Decision | Why / action |
|---|---|---|---|---|
| `react-native` | 0.85.3 | **0.86.0** | **Upgrade** | Core of the SDK bump. Refresh `react-native@*.patch`. |
| `react-native-reanimated` | 4.4.1 | ~4.5 | **Upgrade** | Bundle-mode + fixes. |
| `react-native-worklets` | 0.9.2 | ~0.10 | **Upgrade** | Bundle mode stable. |
| `react-native-gesture-handler` | ~3.0.1 | ~2.32.0 (confirmed) | **Keep local** | Local 3.x is a major AHEAD of 57's pin; keep, verify RN 0.86 compat. |
| `@react-native-async-storage/async-storage` | ^3.1.1 | 2.2.0 | **Keep local** | Do **not** downgrade; verify 3.x runs on RN 0.86. |
| `@shopify/flash-list` | 2.3.2 | 2.0.2 | **Keep local** | Keep newer; verify RN 0.86 compat. |
| `react-native-safe-area-context` | 5.8.0 | ~5.7.0 | **Keep local** | Has a pinned patch (`@5.8.0`) — keep + re-verify patch applies. |
| `react-native-svg` | 15.15.5 | 15.15.4 | **Keep local** | Version **override** only (no pnpm patch); keep pin one ahead. |
| `react-native-keyboard-controller` (storefront) | 1.21.11 | 1.21.9 | **Keep local** | Keep newer. |
| `react-native-web` | ~0.21.2 | ~0.21.0 (confirmed) | **Keep local** | In range; no action. |
| `react-native-screens` | 4.25.2 | 4.25.2 (confirmed) | **Unchanged** | 57 pins the exact local version; no action. |

**Policy:** default to **keep-local** for excluded packages that SDK 57 pins lower; only downgrade if
a package is provably incompatible with RN 0.86. Record the final resolved version + reason per package
in the PR. Distinguish the two lock mechanisms: **patched** deps (in `patchedDependencies`, e.g.
`safe-area-context`, `mmkv`, `webview`, `purchases`) require refreshing the patch file **+** its
`pnpm-workspace.yaml` key in the same change; **override-only** pins (e.g. `react-native-svg`) just
need the `overrides` version bumped — there is no patch to refresh.

---

## Bundle mode composition plan (P1)

Per [Worklets bundle mode setup](https://docs.swmansion.com/react-native-worklets/docs/bundleMode/setup/),
enabling bundle mode is **not** a one-line flag. It requires: Babel plugin option, a Metro wrapper
(`getBundleModeMetroConfig`), a Metro cache reset, and **recommended pnpm patches to `metro` and
`metro-runtime`** (SHA-1 resolution + Fast Refresh fixes). Our Metro configs are custom and
**order-sensitive**, so composition order matters.

**Critical ordering rule:** `getBundleModeMetroConfig` works by **wrapping `resolver.resolveRequest`**.
Storefront's config already assigns a custom `config.resolver = { …, resolveRequest }`
([metro.config.js:60,82](../../apps/mobile-storefront/metro.config.js)) that delegates via
`context.resolveRequest`. So bundle mode must be applied **LAST — after the full Baci config is built**
(PostHog base + package-root pins + blockList + our `resolveRequest`), never before. Applying it before
our resolver assignment would let `config.resolver = {…}` overwrite bundle mode's `resolveRequest`;
applying it after lets bundle mode wrap our (delegating) `resolveRequest` cleanly. If for any reason
bundle mode can't go last, compose Baci's `resolveRequest` *inside* the bundle-mode resolver instead.

- **storefront** [metro.config.js](../../apps/mobile-storefront/metro.config.js): base is
  `getPostHogExpoConfig(projectRoot, { getDefaultConfig })`, then package-root pins + blockList +
  custom `resolveRequest`. → Build that entire config object **first**, then
  `module.exports = getBundleModeMetroConfig(config)` as the **final** step. Verify PostHog's metro
  transform and bundle mode's transform don't conflict, and that our `resolveRequest` still fires.
- **admin** [metro.config.js](../../apps/mobile-admin/metro.config.js): base is `getDefaultConfig`,
  then `react-native-svg-transformer` babelTransformerPath + package-root pins, and the **final export
  is `withSentryConfig(config, {…})`** ([metro.config.js:116](../../apps/mobile-admin/metro.config.js)).
  Bundle mode must be composed with the Sentry wrapper, not instead of it. Recommended order:
  build the full config (incl. svg `babelTransformerPath`) → `getBundleModeMetroConfig(config)` →
  then `withSentryConfig(…)` **outermost** as the export, i.e.
  `module.exports = withSentryConfig(getBundleModeMetroConfig(config), {…})`. **Watch for serializer
  conflict:** both Sentry and bundle mode customize the serializer/transformer — verify (a) Sentry
  source-map upload still produces valid maps and (b) bundle mode's resolver/serializer still fires.
  If they collide, fall back to applying bundle mode *inside* a config that Sentry then wraps, and
  test both behaviors explicitly. Ensure the svg transformer survives (compose, don't overwrite).
- **Babel** (both) [babel.config.js](../../apps/mobile-admin/babel.config.js): already loads
  `react-native-worklets/plugin`; add the bundle-mode option to that plugin entry. Keep
  `babel-plugin-react-compiler` ordering intact.
- **New pnpm patches (likely required):** `metro@<ver>` and `metro-runtime@<ver>` per the setup guide.
  Add to `patchedDependencies` + `overrides` with version pins, following the repo's patch policy.
- **Cache reset** after enabling (`expo start -c` / clear Metro cache) — bundle mode changes the graph.

Deliverable for this phase: exact diff of both metro.config.js, both babel.config.js, the two new
patches, and confirmation the release bundle (not just dev) builds with bundle mode on.

---

## Current versions (baseline)

Both apps: `expo` `~56.0.12`, `expo-router` `~56.2.11`, `react`/`react-dom` `19.2.3`,
`react-native` `0.85.3`, `reanimated` `4.4.1`, `worklets` `0.9.2`, `gesture-handler` `~3.0.1`,
`screens` `4.25.2`, `safe-area-context` `5.8.0`. Storefront `expo-image` `~56.0.11`.

**Confirmed against `expo@57.0.2` `bundledNativeModules.json` (2026-07-05):** SDK 57 pins
`react-native-webview@13.16.1`, `@react-native-community/datetimepicker@9.1.0`,
`lottie-react-native@~7.3.8`, and `react-native-screens@4.25.2` at their exact local versions, and
`react-native-mmkv`/`react-native-nitro-modules` are not Expo-pinned — so **only the two RN patches
orphan** (`react-native@0.85.3`, `@react-native/gradle-plugin@0.85.3`); every other pnpm patch stays
valid as-is. Reanimated target is exactly 4.5.0, worklets 0.10.0. Admin devDep
`@react-native/metro-config` 0.85.3 → 0.86.0. RN template diff 0.85.3→0.86.0 touches **only
package.json** (no native template changes).

**Version-pinned pnpm patches** (orphan on the RN bump → refresh in-PR):
`react-native@0.85.3`, `@react-native/gradle-plugin@0.85.3`, `react-native-mmkv@4.3.1`,
`react-native-nitro-modules@0.35.9`, `react-native-safe-area-context@5.8.0`,
`react-native-webview@13.16.1`, `react-native-purchases@10.2.0`, `lottie-react-native@7.3.8`,
`react-native-phone-number-input@2.1.0`, `@react-native-community/datetimepicker@9.1.0`,
`@react-native-google-signin/google-signin@16.1.2`.

---

## Baseline measurements (SDK 56, recorded 2026-07-05)

Method: debug APK (arm64) + Metro dev client on `Baci_Pixel_9_Pro_XL_API_36_Google` (4096 MB,
2 cores), app foregrounded on its start screen; PSS via `run-as <pkg> cat /proc/<pid>/smaps_rollup`
(kernel-side — `dumpsys meminfo` binder calls time out while the dev-mode main thread is busy);
5 samples × 10 s, median. Post-upgrade (Phase 4) MUST reuse this exact method.

| App | Package | Median PSS | Samples |
|---|---|---|---|
| storefront | com.ogabassey.store | **1,575,934 kB (~1.54 GiB)** | 1,564,018 → 1,587,126 kB (mild upward drift) |
| admin | com.ogabassey.baci | **784,328 kB (~766 MiB)** | flat plateau 781,756 → 784,484 kB over 8 min (48 samples, median of last 5) |

Observation: RN 0.85 dev-mode crashes reproducibly in
`CxxInspectorPackagerConnection.didReceiveMessage` (NPE) when the dev client reconnects to a Metro
whose inspector proxy holds stale sessions from a previous crash; a fresh Metro restart clears it.
RN 0.86 ships DevTools/inspector fixes — re-check this crash after the upgrade (Phase 5).

Baseline suite state: lint/typecheck green; storefront 662 suites / 4,239 tests pass; admin green
(turbo-cached). Both debug APKs build clean (storefront 11m29s cold, admin 6m44s warm).

## Phase 0 — Prep, baseline & storefront tooling gap (P2)

- New branch off `main` in an **isolated worktree**; re-run `pnpm install` after branching.
- Delete stale `*.tsbuildinfo` so typecheck is honest.
- **Fix the storefront QA-tooling gap (blocking, since storefront is lead):** storefront has **no**
  `android:emulator|install|metro|launch` scripts (only `mobile-admin` does) and uses
  `jest --runInBand` (admin uses `vitest`); iOS builds via **Fastlane**, not `scripts/build-ios.sh`
  (that script does not exist). Choose one:
  1. **Port the four launcher scripts** from `mobile-admin/scripts/` to `mobile-storefront/scripts/`
     (recommended — matches CLAUDE.md's "launcher owns GPU/boot/settle" mandate), **or**
  2. Validate storefront on the admin emulator instance via `expo run:android` + manual install.
- **Correct verification commands** used later:
  - Android (admin): `pnpm --filter baci-mobile-admin android:emulator|install|launch`.
  - Android (storefront): the ported scripts, or `expo run:android` (port 8082).
  - iOS: **Fastlane lanes** (`apps/*/fastlane/Fastfile`), not `scripts/build-ios.sh`.
  - Tests: storefront `jest --runInBand`; admin `vitest run` (`pnpm turbo test` covers both).
- **Capture baseline Android memory** (both apps) via `adb shell dumpsys meminfo <pkg>` at steady
  state; save numbers — the bundle-mode win must be measured.
- Green baseline: `pnpm turbo lint typecheck test` + a clean `assembleDebug` + one Fastlane iOS
  build so we know the starting state ships.
- Pull the RN **0.85.3 → 0.86.0** upgrade-helper diff; note native files it touches (informational —
  prebuild applies them, but tells us which local plugins might be affected).

## Phase 1 — JS/Expo bumps + excluded-dep matrix (storefront first)

- Use **app-scoped, pnpm-native** Expo commands throughout (matches the workflows' per-app
  `working-directory`; `--pnpm` forces the pnpm resolver and avoids npm/yarn auto-detection):
  `pnpm --dir apps/mobile-storefront exec expo install expo@^57.0.0 --fix --pnpm` (respects `exclude`).
- Apply the **excluded-dependency matrix** decisions manually (bump RN/reanimated/worklets; keep-local
  the ones SDK 57 pins lower). Run `pnpm --dir apps/mobile-storefront exec expo install --check --pnpm`
  to see 57 targets; record resolved versions + reasons.
- Reconcile `pnpm-workspace.yaml` `overrides` + `patchedDependencies` keys for anything moved.
- Mirror to `mobile-admin` once storefront JS layer is clean.

## Phase 2 — Refresh orphaned patches

- **`@react-native/gradle-plugin@0.85.3.patch` → DELETE, not refresh** (verified 2026-07-05):
  its only change (foojay-resolver-convention 0.5.0 → 1.0.0) is already upstream in RN 0.86.0's
  `settings.gradle.kts`. Remove patch file + `patchedDependencies` key.
- **`react-native@0.85.3.patch` → DROPPED, not re-authored** (evidence gathered 2026-07-05 during
  execution — supersedes the earlier "re-author" decision). The patch edits ReactAndroid **Kotlin
  sources**, but every Baci build path consumes the **prebuilt** `com.facebook.react:react-android`
  AAR from Maven Central (verified: `react-android-0.85.3-debug.aar` in the Gradle cache after the
  baseline build; no `buildFromSource` in gradle.properties, settings.gradle, eas.json,
  expo-build-properties, or release workflows). The patch has been inert since PR #2273 — the
  effective edge-to-edge behavior comes from that PR's other pieces (`withAndroidSystemBars` plugin,
  styles.xml, NavigationBarStyleProvider). On RN 0.86 the deprecated paths are additionally
  runtime-guarded by `isEdgeToEdgeFeatureFlagOn`. Old patch preserved in git history
  (`e9fe6581ea`). **Flag for user review in the PR.**
- Re-verify every other pinned patch applies post-`--fix`; refresh any bumped (esp. any kept-local
  patched dep). `pnpm install` must apply **all** patches with zero "could not apply" warnings.
- **Prune orphaned patch files.** Diff `patches/` against `patchedDependencies` keys and remove stale
  files not referenced by any active key. Known orphans today (verify + delete):
  `patches/@expo/log-box@55.0.8.patch` (SDK 55 era),
  `patches/@react-native-async-storage/async-storage@3.0.2.patch` (local is 3.1.1),
  `patches/@react-native/gradle-plugin@0.84.1.patch` (RN 0.84). Leaving these makes the RN-0.86 patch
  refresh ambiguous. Justify any kept-but-unreferenced file in the PR.
- Update the patch-policy comment block in `pnpm-workspace.yaml`.

## Phase 3 — Config-plugin & prebuild validation (replaces "hand-apply diffs")

- Run (app-scoped, pnpm-native)
  `pnpm --dir apps/mobile-storefront exec expo prebuild --platform android --clean --pnpm` and the
  `--platform ios` variant locally on RN 0.86 for **storefront**; confirm all 6 local
  `./config/with*.js` plugins apply without error and
  `withAndroidGradleFixes` still produces valid Gradle.
- Repeat for **admin** (`pnpm --dir apps/mobile-admin exec expo prebuild … --pnpm`): confirm its 2
  local `./config/with*.js` plugins, `@sentry/react-native/expo`, and especially
  `./plugins/with-ios-release-hardening` all apply against the RN-0.86 pbxproj — verify the
  `withXcodeProject`/entitlements/Info.plist mutations land and the archive still signs.
- Re-verify the iOS workflow's post-prebuild `sed` signing-style fix still matches the regenerated
  pbxproj.
- Regenerate the committed native dirs from the 0.86 prebuild for local-dev parity (commit the
  refreshed subset). Confirm `expo run:android|ios` works locally.
- Confirm `expo-build-properties` (SDK 36 / buildTools 36 / iOS 16.4 / static frameworks) is valid on
  0.86 in both apps.
- **Revisit the disabled `expo.doctor.appConfigFieldsNotSyncedCheck`** in both `package.json` files.
  Its reason text ("native android/ios projects are committed and are the source of truth … non-CNG
  setup") **contradicts the corrected architecture** — release *is* CNG via prebuild. Either re-enable
  the check (now that plugins are the source of truth) or rewrite the reason to state accurately why
  it's off. Then run SDK 57's recommended doctor per app:
  `pnpm --dir apps/mobile-storefront dlx expo-doctor@latest` (and admin) — resolve or document every
  warning.

## Phase 4 — Enable worklets bundle mode (the memory win)

- Implement the **Bundle mode composition plan** above: babel option, `getBundleModeMetroConfig`
  wrapping (PostHog base for storefront; svg-transformer **+ outer `withSentryConfig` wrap** for
  admin), new `metro`/`metro-runtime` patches, cache reset.
- Rebuild `assembleDebug`, re-measure Android heap/RSS vs Phase 0. **Record the actual delta** — do
  not assert the 25–30% recovery without the number. Confirm the **release** bundle builds with bundle
  mode on, not just dev.

## Phase 5 — Verify (both apps, both platforms)

- `pnpm turbo lint typecheck test` green (storefront jest + admin vitest).
- **Android:** launcher/`expo run` per Phase 0; smoke every core flow; check API 36 edge-to-edge
  (should improve). Storefront then admin.
- **iOS:** Fastlane build lanes succeed (signed, never unsigned); device smoke.
- Confirm SDK 57 APIs we'll adopt compile (`expo-image` `writeToCacheAsync`/`readFromCacheAsync`;
  `Stack.Toolbar.Badge`).
- Bump build numbers in `app.config.ts` (source of truth) if cutting test builds — release CI reads
  these into prebuild.

## Phase 6 — Ship

- Local guards before first push: module-size, route-size, platform-drift, knip.
- CodeRabbit `--prompt-only`; fix criticals.
- One scoped PR: `chore(mobile): upgrade Expo SDK 56→57 + worklets bundle mode`. Rebase on
  `origin/main` first; never `--no-verify` / `--admin` on a behind branch.
- PR body: baseline vs post-upgrade Android memory numbers, excluded-dep resolution table,
  patch-refresh list, config-plugin/prebuild validation notes.

---

## Rollback

Single revert (isolated branch + one PR). Release path regenerates native from plugins, so reverting
the plugin/config/patch changes fully restores prior native output — no manual native reconstruction.

---

## Risks, ranked

1. **Config plugins break on RN 0.86 prebuild** — esp. admin's `./plugins/with-ios-release-hardening`
   (`withXcodeProject` against the new pbxproj template) and `withAndroidGradleFixes` in both apps.
   This is the real native risk, not committed-dir diffs. Caught by running prebuild in Phase 3.
2. **`react-native@0.86` + gradle-plugin patch refresh** — patch intent may not apply to 0.86 source →
   Android build breaks.
3. **Bundle mode × custom Metro configs** — storefront's PostHog base + custom `resolveRequest`, and
   admin's svg transformer **wrapped by `withSentryConfig`** (serializer/transformer collision risk) +
   required `metro`/`metro-runtime` patches — test the **release** bundle, not just dev.
4. **Accidental downgrade of excluded deps** (async-storage, FlashList, safe-area) if the matrix isn't
   followed — SDK 57 pins them below local.

## Sources

- Expo SDK 57 changelog (published 2026-06-30): https://expo.dev/changelog/sdk-57
- React Native 0.86 release notes: https://reactnative.dev/blog/2026/06/11/react-native-0.86
- Worklets bundle mode setup: https://docs.swmansion.com/react-native-worklets/docs/bundleMode/setup/
