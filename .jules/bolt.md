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
## 2025-05-19 - Explicit getItemLayout in FlatList
**Learning:** React Native's FlatList performance can be degraded significantly on large sets (like countries or history lists) if the UI thread has to asynchronously measure the height of each item layout continuously during scroll.
**Action:** Always provide an explicit `getItemLayout` prop to `FlatList` when rendering lists of predictable fixed-height items to bypass measurement cycles and optimize list rendering performance.
