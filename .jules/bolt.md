## 2026-02-19 - [Middleware Performance]
**Learning:** Middleware runs on every request. Re-instantiating complex objects like RegExp inside the handler adds unnecessary overhead. Moving them to module-level constants avoids this.
**Action:** Always check middleware/proxy files for object instantiation in the main handler function.

## 2026-02-19 - [LCP Optimization]
**Learning:** Product grids often lazy-load all images by default, hurting LCP. The first few items (above the fold) should be eager loaded with high priority.
**Action:** Pass a `priority` prop to product cards based on index (e.g., `priority={index < 4}`) to eager load the first row.

## 2026-02-19 - [Thumbnail Image Optimization]
**Learning:** Checkout pages often list many small product images. Using raw `<img>` tags prevents Next.js from optimizing these (lazy loading, responsive sizing).
**Action:** Use `ThumbnailImage` (or `OptimizedImage` with `layout="thumbnail"`) for small lists to ensure lazy loading and proper dimensions, reducing initial page weight and CLS.

## 2026-02-28 - Optimize Staff Member Fetches
**Learning:** Replaced `select('*')` with explicit column selections in `apps/web/src/app/api/staff/route.ts` and `apps/web/src/app/api/staff/[id]/route.ts` to reduce database load and network transfer payload, particularly avoiding fetching unnecessary sensitive columns like `invitation_token` when not needed.
**Action:** Always select specific required columns instead of `*` when querying Supabase to minimize payload size and improve database performance.

## 2026-03-01 - [API Performance - Supabase select]
**Learning:** Replacing `select('*')` with explicitly listed columns for retrieving the entire entity or using `select('id', { count: 'exact', head: true })` instead of `select('*', { count: 'exact', head: true })` for count-only queries reduces database load and network payload significantly.
**Action:** Always specify only the needed columns, or exactly the known columns, rather than `select('*')`, and ensure count queries fetch no actual columns (e.g., use `id`).