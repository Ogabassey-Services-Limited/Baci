## 2026-01-01 - [Inline JSX in List Rendering]
**Learning:** `StorefrontProductGrid` was rendering complex product cards inline within the map loop. This prevents React from optimizing list updates (e.g. quantity changes) and forces re-renders of all items.
**Action:** Always extract list items into separate, memoized components (`React.memo`) to enable granular updates and prevent VDOM thrashing.
