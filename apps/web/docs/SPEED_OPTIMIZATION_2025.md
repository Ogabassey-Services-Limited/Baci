# 2025 Speed Optimization Best Practices (Next.js 16 & React 19)

## 1. React Compiler (Automatic Memoization)
*   **Status**: Stable (Next.js 16.0.6+)
*   **Configuration**: Enable `reactCompiler: true` in `next.config.ts`.
*   **Best Practice**: Relies on automatic usage analysis to memoize components and values. Manual `useMemo` and `useCallback` should only be used for specific edge cases or when interfacing with external non-React libraries.

## 2. Server Actions & Caching
*   **Status**: Stable
*   **Data Fetching**: Use `unstable_cache` (migrating to the standard `use cache` directive when stable) for expensive database queries.
*   **Cache Invalidation**: Implement granular cache tagging with `revalidateTag` for precise on-demand invalidation.
*   **Waterfall Prevention**: Fetch data at the root of the component tree or parallelize requests. Avoid serial data fetching in Client Components.

## 3. Modern Image Formats
*   **Formats**: Prioritize AVIF with WebP fallback (`formats: ['image/avif', 'image/webp']`).
*   **LCP Optimization**: Ensure the Largest Contentful Paint image uses the `priority` prop (which applies `fetchPriority="high"`) and the `sizes` attribute to prevents layout shifts.

## 4. CSS Optimization
*   **Architecture**: CSS Modules or Utility-First CSS (Tailwind) are preferred to eliminate runtime CSS-in-JS overhead.
*   **Experimental**: `inlineCss: true` in `next.config.ts` can reduce blocking resources by inlining critical CSS, but requires thorough testing across routes.

## 5. Font Optimization
*   **Loading**: Use `next/font` to automatically optimize and self-host fonts, removing external network round-trips.
*   **Display**: Always use `display: 'swap'` to ensure text is visible during font loading.

## 6. Script Loading
*   **Strategy**: Defers third-party scripts (analytics, chat widgets) using `next/script`.
*   **Implementation**: Use `strategy="lazyOnload"` for non-critical scripts or offload to web workers using Partytown (`strategy="worker"`) to keep the main thread free for UI interactivity.

## 7. Partial Prerendering (PPR)
*   **Status**: Experimental
*   **Concept**: Combines static shell generation with dynamic content streaming.
*   **Adoption**: Enable `ppr: true` in `experimental` config only for evaluation purposes. Not yet recommended for critical production paths without extensive validation.

## 8. Bundle Optimization
*   **Tree Shaking**: Use `optimizePackageImports` in `next.config.ts` to automatically tree-shake large libraries (e.g., `lucide-react`, `lodash`).
*   **Code Splitting**: Implement `dynamic()` imports for heavy, below-the-fold components (charts, maps, rich text editors).

## 9. Backend & Database Optimization (Supabase)
*   **Aggregation**: Offload calculations (e.g., sales totals, analytics) to the database using PostgreSQL RPC (Remote Procedure Call) functions or Materialized Views instead of processing large datasets in the application server.
*   **Indexing**: Ensure Foreign Keys and frequently queried columns (e.g., `created_at` for sorting) are properly indexed.
*   **Data Access**: Use the Service Role client for public, read-only aggregation tasks during Static Site Generation (SSG) to bypass unnecessary RLS checks, provided data is non-sensitive.
