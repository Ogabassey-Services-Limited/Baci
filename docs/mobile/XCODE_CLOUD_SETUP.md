# Xcode Cloud Setup (Admin + Storefront)

This repository contains two iOS apps:

- Admin app: `apps/mobile-admin/ios/Baci.xcworkspace` (scheme `Baci`)
- Storefront app: `apps/mobile-storefront/ios/Ogabassey.xcworkspace` (scheme `Ogabassey`)

`ci_scripts/ci_post_clone.sh` at the repo root installs Node.js via Homebrew (if missing), then bootstraps pnpm dependencies and CocoaPods.
Each iOS app also includes an app-local wrapper script at:

- `apps/mobile-admin/ios/ci_scripts/ci_post_clone.sh`
- `apps/mobile-storefront/ios/ci_scripts/ci_post_clone.sh`

Xcode Cloud looks for `ci_scripts/ci_post_clone.sh` in the selected workspace context, so keep these wrapper files in each app workspace.
For `apps/mobile-storefront/ios/Ogabassey.xcworkspace`, ensure `apps/mobile-storefront/ios/ci_scripts/ci_post_clone.sh` exists and delegates to the repo-root bootstrap script.

## 1. App Store Connect Prerequisites

1. Ensure both App Store Connect apps exist.
2. Use bundle ID `com.ogabassey.baci` for the admin app.
3. Use bundle ID `com.ogabassey.store` for the storefront app.
4. Ensure certificates and profiles are managed for team `6QLNK7TXM3`.
5. Ensure both schemes are shared (already committed in `xcshareddata/xcschemes`).

## 2. Create Admin Workflow

In App Store Connect -> Xcode Cloud -> Workflows:

1. Create workflow for the workspace `apps/mobile-admin/ios/Baci.xcworkspace`.
2. Select scheme `Baci`.
3. Start condition: `Branch Changes` on `main` (or your release branch).
4. Action: `Archive`.
5. Destination: `Any iOS Device (arm64)`.
6. Post-action: distribute to `TestFlight` (internal group first).

## 3. Create Storefront Workflow

1. Create workflow for the workspace `apps/mobile-storefront/ios/Ogabassey.xcworkspace`.
2. Select scheme `Ogabassey`.
3. Start condition: `Branch Changes` on `main` (or your release branch).
4. Action: `Archive`.
5. Destination: `Any iOS Device (arm64)`.
6. Post-action: distribute to `TestFlight` (internal group first).

## 4. Environment Variables (Xcode Cloud)

Set these in each workflow (Environment Variables tab).

Common (required by both workflows):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_URL`
- `BACI_ASC_KEY_ID`
- `BACI_ASC_ISSUER_ID`
- `BACI_ASC_PRIVATE_KEY`

Optional release-version controls:

- `CI_APP_STORE_CONNECT_APP_ID` — override the App Store Connect app ID if the repo default is missing or incorrect.
- `CI_MARKETING_VERSION` — force an exact marketing version for a release.
- `CI_MARKETING_BUMP` — one of `patch`, `minor`, or `major` when auto-resolving the next valid marketing version from App Store Connect. Defaults to `patch`.

Admin-specific:

- `EXPO_PUBLIC_WEB_API_URL`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`
- `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` — Recommended for cross-platform parity and required for Android builds. The app reads both platform key env vars, and the RevenueCat SDK selects the correct key at runtime.

## 5. First Validation Run

1. Run each workflow once manually from Xcode Cloud UI.
2. Confirm `ci_post_clone.sh` logs appear in build logs.
3. Confirm archive is created and delivered to TestFlight.
4. Install on physical devices via TestFlight and validate login, API calls, push notifications, and payments/checkout critical flows.

## 6. Troubleshooting / FAQ

**What to do if the archive fails?**

1. Open the failed build in Xcode Cloud UI (App Store Connect > Xcode Cloud > Builds).
2. Check the build logs — look for errors in the `ci_post_clone.sh` output first (dependency install or CocoaPods failures).
3. Common fixes:
   - **"Missing required command 'node'":** The script auto-installs Node.js via Homebrew. If this still fails, ensure the Xcode Cloud macOS image has Homebrew available (all current images do). Check that `brew install node` completes in the build logs.
   - **Provisioning / certificate issues:** Ensure certificates and profiles for team `6QLNK7TXM3` are valid and not expired. Xcode Cloud auto-manages signing, but manual profiles need re-uploading if revoked.
   - **Missing environment variables:** Verify all variables from Section 4 are set in the workflow's Environment Variables tab. A missing `EXPO_PUBLIC_SUPABASE_URL` or similar will cause runtime config errors during the build.
   - **CocoaPods or dependency errors:** If `pod install` fails, check that the lockfile is committed and dependencies resolve correctly. The CI script pins CocoaPods to the version recorded in `Podfile.lock` (`COCOAPODS: x.y.z`) so `--deployment` mode works reliably. If you upgrade CocoaPods locally, run `pod install` to regenerate the lockfile and commit it.
   - **"Unable to authenticate with App Store Connect":** This is a transient Xcode Cloud session issue. Re-run the build. If it persists, check that your Apple ID in the Xcode Cloud workflow still has App Store Connect access for team `6QLNK7TXM3`.
4. To rerun: open the workflow in Xcode Cloud UI and click **Start Build**, or push a new commit to the trigger branch.

**Where to find detailed build logs?**

- App Store Connect > Xcode Cloud > select the build > **Logs** tab.
- Build artifacts (`.xcarchive`, logs) are available for download from the build detail page.

**Still stuck?**

If issues persist after checking logs and env vars, reach out to the CI/platform team or consult [Apple's Xcode Cloud documentation](https://developer.apple.com/documentation/xcode/xcode-cloud).
