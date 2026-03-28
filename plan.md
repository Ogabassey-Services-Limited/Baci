1. **Optimize `filteredProducts` and `availableOptions` computations in `CategoryPage`:**
   - Both `filteredProducts` and `availableOptions` are currently computed on every render in `apps/web/src/components/storefront/ogabassey/pages/category-page.tsx`. This causes unnecessary heavy computations, especially since iterating and sorting sets are expensive operations and product lists can be long.
   - I will wrap `availableOptions` in `useMemo` with dependency on `products` (which maps to `categoryProducts`).
   - I will wrap `filteredProducts` in `useMemo` with dependencies on `products` and `filters`.
   - I will also add `import { useMemo }` to the imports from `react`.

2. **Run tests to ensure everything still passes.**
   - I will run the frontend build and linter to make sure there are no errors.

3. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**

4. **Submit PR.**
