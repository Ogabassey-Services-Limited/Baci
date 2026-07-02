## 2025-05-11 - Do not use useDeferredValue for debouncing network requests

**Learning:** In the Baci monorepo, `useDeferredValue` is not an effective way to debounce network requests triggered by search inputs. While it helps keep the UI responsive by deferring the render of slow components, it does not prevent the underlying `useProducts` or `useQuery` hooks from firing a request on every single keystroke.
**Action:** Always use a proper `useDebounce` hook (e.g., `const debouncedQuery = useDebounce(query, 300)`) to delay the actual state update that is passed to the data fetching hook.

## 2025-05-15 - React Native FlatList optimizations with getItemLayout

**Learning:** In Expo/React Native, `FlatList` components rendering predictable or fixed-height items without an explicit `getItemLayout` prop force the framework to calculate item dimensions asynchronously, causing significant UI thread overhead and skipped frames during scroll/mount.
**Action:** Always provide the `getItemLayout` prop alongside explicit sizing (like `height: N`) in item containers to optimize performance by bypassing asynchronous measurement cycles.

## 2025-02-23 - Add staleTime to prevent redundant data fetching

**Learning:** React Query hooks like `useCustomer` will refetch data from Supabase on every component mount or window focus by default, which degrades perceived performance and increases database load when navigating back and forth to customer details.
**Action:** Always configure `staleTime` (e.g., `1000 * 60 * 2` for 2 minutes) on data-fetching hooks for reasonably static data like customer profiles to ensure React Query serves cached data instead of triggering redundant network requests.

## 2025-05-16 - Safe data fetching within useEffect

**Learning:** When fetching data asynchronously within a `useEffect` (e.g., for debounced autocomplete searches), failing to check if the component is still mounted before setting state can cause race conditions where stale data overwrites fresh data if earlier requests resolve after later ones.
**Action:** Always implement an `isMounted` boolean flag within the effect, check it before calling state setters like `setSuggestions`, and toggle it to `false` in the cleanup function.

## 2025-05-19 - Exact getItemLayout only for fixed-axis FlatLists

**Learning:** React Native's `getItemLayout` is safe only when each item has an exact, deterministic size on the scroll axis. Rough estimates for text-heavy vertical rows, country lists, addresses, or history cards can corrupt offsets when content wraps or font scaling changes.
**Action:** Provide `getItemLayout` only when the rendered item enforces the exact scroll-axis dimension, such as a horizontal pager whose item width is the viewport width. Leave variable-height lists to React Native's measurement path.

## 2025-05-24 - Prevent redundant queries by adding staleTime

**Learning:** In the mobile admin app, several React Query hooks (`useStaffAccounts`, `useStoreReadiness`, `useQuickAddProductMatches`) lacked `staleTime` configurations, causing them to refetch data immediately upon remounting or window focus, leading to unnecessary Supabase database load.
**Action:** Always configure `staleTime` (e.g., `1000 * 60 * 5` for 5 minutes) on data-fetching queries to prevent over-fetching when the user navigates between screens.

## 2025-05-25 - Prevent redundant queries by adding staleTime to specific admin screens

**Learning:** React Query hooks like `useQuery` without a configured `staleTime` default to 0. In mobile-admin components like `profile`, `kyc`, `domains`, `shipping`, `payment-methods`, and `expenses`, this causes Supabase data to be refetched on every screen focus, which is unnecessary for static data.
**Action:** Always configure `staleTime` (e.g., `1000 * 60 * 5` for 5 minutes) on data-fetching hooks for relatively static data to prevent over-fetching when navigating back and forth to these screens.

## 2025-05-25 - Prevent redundant queries by adding staleTime to specific admin screens

**Learning:** React Query hooks like `useQuery` without a configured `staleTime` default to 0. In mobile-admin components like `useOrder`, this causes Supabase data to be refetched on every screen focus, which is unnecessary for static data.
**Action:** Always configure `staleTime` (e.g., `1000 * 60` for 1 minute) on data-fetching hooks for relatively static data to prevent over-fetching when navigating back and forth to these screens.

## 2025-05-27 - Prevent redundant queries by adding staleTime to specific admin screens

**Learning:** React Query hooks like `useQuery` without a configured `staleTime` default to 0. In mobile-admin components like `useProductPickerVariants` and `useUnlinkedOrderItemReconciliation`, this causes Supabase data to be refetched on every screen focus, which is unnecessary for static data.
**Action:** Always configure `staleTime` (e.g., `1000 * 60 * 5` for 5 minutes) on data-fetching hooks for relatively static data to prevent over-fetching when navigating back and forth to these screens.

## 2025-05-30 - Prevent redundant queries by adding staleTime to specific admin screens

**Learning:** React Query hooks like `useQuery` without a configured `staleTime` default to 0. In mobile-admin components like `analytics-config` and `payout-settings`, this causes Supabase data to be refetched on every screen focus, which is unnecessary for static configuration data.
**Action:** Always configure `staleTime` (e.g., `1000 * 60 * 5` for 5 minutes) on data-fetching hooks for relatively static configuration data to prevent over-fetching when navigating back and forth to these screens.

## 2025-05-30 - Keep admin entity detail caches tenant-scoped and short-lived

**Learning:** Admin entity details such as products and orders are mutable operational data, not static configuration. Their React Query keys must include tenant context and their freshness windows must stay short enough to avoid stale inventory edits.
**Action:** Include the merchant id in detail query keys and prefer short `staleTime` values (for example, 30 seconds) unless the data has real-time invalidation or optimistic concurrency controls.

## 2026-06-03 - Replaced .select() with specific column selection in features API

**Learning:** Returning all columns by default via `.select()` (or `.select('*')`) on database mutations (POST/PATCH/PUT) causes unnecessary data overfetching in response payloads.
**Action:** When updating or inserting records using Supabase, always supply explicit column names to `.select()`, for example: `.select(MERCHANT_FEATURE_SELECT_FIELDS.join(', '))`, to minimize database query planning overhead and JSON payload size.

## 2025-06-03 - [Replace select('*') with select('id') for explicit column selection]

**Learning:** In Supabase queries, using .select() without arguments defaults to fetching all columns, which violates explicit column selection rules and leads to overfetching.
**Action:** Always specify exact columns like .select('id') when inserting rows or retrieving specific data to reduce query overhead.

## 2024-06-14 - Optimize Location Picker FlatLists

**Learning:** In the mobile-storefront app, dynamically heighted list items inside modals can cause UI thread asynchronous measurement cycles when rendered by FlatList, leading to slow rendering of pickers like City and State.
**Action:** Always fix the height of simple picker row items (e.g., changing `minHeight` to `height` in stylesheets) and implement explicit `getItemLayout` on the corresponding `FlatList` to bypass runtime measurements and dramatically speed up rendering.

## 2026-06-28 — Parallelize independent Supabase reads safely

**Learning:** `Promise.all` is appropriate for independent reads when later validation still checks every result before side effects. Do not parallelize queries that depend on an earlier row's contents.
**Action:** For hot API paths, fetch merchant/order/related read-only rows concurrently only when each query is scoped independently by the authenticated tenant id and all errors are handled before writes.
**Source:** MDN Promise.all docs and Supabase JavaScript filter/update docs, verified 2026-06-28.
