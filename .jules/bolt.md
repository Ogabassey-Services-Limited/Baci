## 2024-05-23 - Turbo Test Path Resolution
**Learning:** Running `turbo test` from the root with a specific file path argument (e.g., `turbo test --filter @baci/web -- apps/web/src/foo.test.tsx`) fails because `turbo` changes the working directory to the package root, making the relative path invalid.
**Action:** When running specific tests for a package, use `cd apps/web && pnpm test src/foo.test.tsx` instead of running via `turbo` from the root, or ensure the path argument is relative to the package root if the tool supports it (which `vitest` via `turbo` might not handle as expected).

## 2024-05-23 - Array to Map/Set Optimization Safety
**Learning:** When optimizing array lookups to `Set` or `Map` lookups, always guard against `undefined` inputs (e.g., `new Set(items || [])`). Unlike optional chaining (`items?.filter(...)`) which gracefully returns undefined, the `Set` and `Map` constructors throw a `TypeError` if passed `undefined`.
**Action:** Always wrap potential undefined arrays with `|| []` when passing to `new Set()` or `new Map()`.
