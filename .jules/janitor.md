## 2026-02-18 - Mobile Admin useCallback Cleanup
**Learning:** `expo lint` in `apps/mobile-admin` enforces `react-hooks/exhaustive-deps`, which conflicts with removing `useCallback` if the function is used in `useEffect`.
**Action:** Instead of keeping `useCallback`, move the function definition INSIDE the `useEffect` hook. This satisfies both React Compiler (no manual memoization) and the linter (no missing dependencies).
