# Ogabassey Mobile Architecture Guide (2025)

## 1. The Core Philosophy: "Web-Mobile Unification"
The Ogabassey platform is built on a "Shared Brain" architecture. Business logic is never duplicated.

- **Source of Truth:** All commerce math (VAT, Delivery, Commissions, Loyalty) resides in the Supabase Edge Function `calculate-commerce`.
- **Parity:** Both the Next.js Web store and the React Native Mobile app call the same Edge Function via the `calculateCommerce` helper.

## 2. The "Engine": High-Performance Persistence
We use a **Flash-Load** pattern to eliminate perceived loading times.

- **Stack:** TanStack Query v5 + MMKV Storage.
- **MMKV:** A C++ based key-value store that is ~10x faster than AsyncStorage.
- **Persistence:** The `queryPersister` (in `lib/query-client.ts`) hydrates the app state from disk in <50ms.
- **Image Resilience:** `expo-image` is used globally with **Blurhash** placeholders to prevent white-box flashes during asset hydration.

## 3. The "Pulse": Real-time & Engagement
The app feels "alive" through reactive data flows.

- **Real-time:** Supabase `postgres_changes` listeners are integrated into data hooks (e.g., `useWallet`).
- **Optimistic UI:** Cart actions and Wishlist toggles update the UI in <16ms (1 frame) and sync with the database in the background.
- **Push Notifications:** Deep-linked notifications are handled via `services/push-notifications.ts`.

## 4. The "Ironclad": Reliability
- **Strict Validation:** Every input is guarded by **Zod** schemas (in `lib/validation.ts`) with Nigerian-specific regex for phone numbers.
- **Error Boundaries:** A global `GlobalErrorBoundary` catches crashes and provides a "Retry" path for network or server failures.
- **Deep Linking:** Configured via `expo-router` to allow marketing campaigns (`ogabassey://product/[slug]`) to open the app directly.

## 5. Directory Structure
- `/app`: Expo Router file-based navigation.
- `/components/storefront`: Reusable UI blocks matching the Baci Web design system.
- `/hooks`: Custom hooks encapsulating logic (e.g., `use-cart`, `use-wallet`).
- `/lib`: Core infrastructure (Supabase, Validation, Query Client).
- `/services`: Third-party integrations (Analytics, Notifications).
- `/stores`: Global state management via Zustand.
