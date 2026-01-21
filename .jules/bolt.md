## 2024-05-23 - Memoizing List Items for Performance
**Learning:** React components that render lists with inline JSX for complex items (like product cards) will re-render *all* items when parent state changes (e.g., cart updates), even if individual items haven't changed.
**Action:** Extract list items into separate, `React.memo` wrapped components. Ensure callback props passed to them are stable (use `useCallback`). This isolates re-renders to only the items that actually change.
