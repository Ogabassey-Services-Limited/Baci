# Android Domain Purchase Review Switch

## Goal

Temporarily remove domain-purchase access from the Android mobile-admin app to clear the current Google Play review concern, while preserving the existing iOS purchase flow and all connect/manage-domain functionality.

Re-enabling Android purchasing must require changing one centralized boolean and rebuilding the app.

## Scope

### Android

- Hide the "Get a custom domain" card from the add-domain screen.
- Hide the "Buy a domain" action from the empty-domain state.
- Keep "Connect to a domain", DNS setup, verification, primary-domain selection, and existing-domain management available.
- Guard direct navigation to `/domains/buy` so it cannot expose domain search, prices, Paystack initialization, or an external checkout.
- Do not show a message or link encouraging users to buy on the website.

### iOS

- Preserve the current domain-search and Paystack purchase flow without behavioral changes.

### Web and backend

- Make no changes to web domain purchasing, Paystack routes, registration, callbacks, pricing, or database state.

## Central Switch

Add a focused mobile-admin configuration module that owns the temporary switch:

```ts
const ANDROID_DOMAIN_PURCHASE_ENABLED = false;
```

The module will expose a typed availability function that combines this flag with the existing runtime-platform helper. Android uses the flag; iOS and other existing supported runtimes remain enabled.

Changing the constant to `true` and rebuilding restores all Android purchase entry points and the direct buy screen. No component-specific flags or duplicated platform checks will be introduced.

## UI and Navigation Behavior

1. The add-domain screen consults the centralized availability function. When disabled, it renders only the connect-existing-domain card and Android-appropriate introductory copy.
2. The domains empty state accepts purchase availability and omits its buy action when disabled. Its connect action remains visible.
3. The `/domains/buy` route checks the same availability function before mounting purchase UI. Disabled Android builds redirect to `/domains/connect`, preventing stale links or direct navigation from reaching Paystack.
4. The iOS path returns the current UI and behavior.

## Testing

- Add unit coverage for the centralized switch: Android disabled, iOS enabled, and non-Android default behavior.
- Update the add-domain screen tests to prove the buy card is hidden on Android, connect remains visible, and iOS still shows both choices.
- Update the domains-index tests to prove Android empty state cannot navigate to `/domains/buy` while connect remains available.
- Update the buy-route tests to prove Android direct navigation redirects without searching, initializing payment, or opening a browser; retain the existing iOS purchase tests.
- Run the focused mobile-admin test files, platform-drift check, Biome lint, and mobile-admin typecheck before broader repository quality gates.

## Non-goals

- Replacing Paystack with Google Play Billing.
- Changing Baci Pro or RevenueCat subscription behavior.
- Removing domain-purchase source code.
- Changing iOS behavior.
- Adding remote configuration or a database-managed feature flag.
- Implementing regional external-payment programs.

## Rollback

Set `ANDROID_DOMAIN_PURCHASE_ENABLED` to `true`, rebuild Android, and submit the new build. The shared switch restores the hidden entry points and route without reverting component code.
