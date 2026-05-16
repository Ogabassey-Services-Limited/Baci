## 2025-05-11 - Do not use useDeferredValue for debouncing network requests
**Learning:** In the Baci monorepo, `useDeferredValue` is not an effective way to debounce network requests triggered by search inputs. While it helps keep the UI responsive by deferring the render of slow components, it does not prevent the underlying `useProducts` or `useQuery` hooks from firing a request on every single keystroke.
**Action:** Always use a proper `useDebounce` hook (e.g., `const debouncedQuery = useDebounce(query, 300)`) to delay the actual state update that is passed to the data fetching hook.

## 2025-05-15 - React Native FlatList optimizations with getItemLayout
**Learning:** In Expo/React Native, `FlatList` components rendering predictable or fixed-height items without an explicit `getItemLayout` prop force the framework to calculate item dimensions asynchronously, causing significant UI thread overhead and skipped frames during scroll/mount.
**Action:** Always provide the `getItemLayout` prop alongside explicit sizing (like `height: N`) in item containers to optimize performance by bypassing asynchronous measurement cycles.
