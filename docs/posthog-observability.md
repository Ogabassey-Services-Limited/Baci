# PostHog Observability Setup

This repo sends PostHog data from three surfaces:

- `apps/web`: Next.js browser analytics, Web Vitals, session replay, client exceptions, server request errors, and source maps.
- `apps/mobile-storefront`: React Native lifecycle, ecommerce events, session replay, JS exceptions, native crashes, source maps, and native debug symbols.
- `@baci/shared/contracts`: typed ecommerce event names and properties shared across clients.

## Web Env

Set these on the production build runner and deployment environment:

```bash
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
NEXT_PUBLIC_POSTHOG_ASSETS_HOST=https://eu-assets.i.posthog.com
NEXT_PUBLIC_POSTHOG_UI_HOST=https://eu.posthog.com
NEXT_PUBLIC_POSTHOG_PROXY_PATH=/baci-relay
POSTHOG_PROJECT_TOKEN=phc_...
```

For source maps, also set build-time secrets:

```bash
POSTHOG_API_KEY=phx_...
POSTHOG_PROJECT_ID=202711
POSTHOG_RELEASE_VERSION=$VERCEL_GIT_COMMIT_SHA
```

`NEXT_PUBLIC_POSTHOG_PROXY_PATH` must not use obvious names like `/analytics`, `/tracking`, `/telemetry`, or `/posthog`. The default `/baci-relay` follows PostHog's rewrite guidance.

## Mobile Env

Set these in EAS/CI and release-like local builds:

```bash
EXPO_PUBLIC_POSTHOG_API_KEY=phc_...
EXPO_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
POSTHOG_CLI_HOST=https://eu.posthog.com
POSTHOG_CLI_PROJECT_ID=202711
POSTHOG_CLI_API_KEY=phx_...
```

`POSTHOG_CLI_API_KEY` needs Error Tracking write access. The Expo plugin uploads JavaScript source maps during native builds and uploads native symbols when `uploadNativeSymbols: true` is applied during prebuild. For OTA updates, run source-map upload after `eas update` or `npx expo export --dump-sourcemap`:

```bash
pnpm --filter @baci/mobile-storefront exec posthog-cli hermes upload --directory dist
```

## Required PostHog Project Settings

In PostHog project `202711`, enable:

- Web Analytics and Web Vitals autocapture.
- Error Tracking and exception autocapture.
- Session Replay with privacy masking.
- React Native native crash capture.
- Source maps / symbol sets for web and mobile releases.

## Verification

After deployment or release build:

1. Load a public storefront page and confirm network requests to `/baci-relay`.
2. Confirm `$pageview`, `$web_vitals`, and `$exception` appear in PostHog Live Events.
3. Trigger a handled test exception only in a non-production test build and confirm it appears with `app_surface`.
4. Confirm web symbol sets are present for release `baci-web`.
5. Confirm mobile JavaScript source maps and native symbols are present for the app build.

Official references used:

- https://posthog.com/docs/libraries/next-js
- https://posthog.com/docs/advanced/proxy/nextjs
- https://posthog.com/docs/web-analytics/web-vitals
- https://posthog.com/docs/error-tracking/upload-source-maps/nextjs
- https://posthog.com/docs/libraries/react-native
- https://posthog.com/docs/error-tracking/upload-source-maps/react-native
- https://posthog.com/docs/data/event-spec/ecommerce-events
