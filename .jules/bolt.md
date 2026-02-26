## 2026-02-19 - [Middleware Performance]
**Learning:** Middleware runs on every request. Re-instantiating complex objects like RegExp inside the handler adds unnecessary overhead. Moving them to module-level constants avoids this.
**Action:** Always check middleware/proxy files for object instantiation in the main handler function.

## 2026-02-19 - [LCP Optimization]
**Learning:** Product grids often lazy-load all images by default, hurting LCP. The first few items (above the fold) should be eager loaded with high priority.
**Action:** Pass a `priority` prop to product cards based on index (e.g., `priority={index < 4}`) to eager load the first row.

## 2026-03-01 - [OptimizedImage State Bug]
**Learning:** Custom wrapper components around `next/image` (like `OptimizedImage`) that maintain internal state (e.g., for fallbacks) must explicitly update that state when props change (via `useEffect` or key), otherwise dynamic updates (like color variants) will fail.
**Action:** Always verify state synchronization in wrapper components when refactoring for performance.
