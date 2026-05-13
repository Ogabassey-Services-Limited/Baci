## 2026-05-12 - Prevent API overfetching with useDebounce
**Learning:** React's useDeferredValue only defers UI rendering and still triggers a request on every keystroke when passing search queries to React Query hooks.
**Action:** Always explicitly debounce the search input using a useDebounce hook to prevent unnecessary API calls.
