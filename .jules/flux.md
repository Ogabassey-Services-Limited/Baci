## 2026-02-15 - Cart Validation Race Condition
**Learning:** Manual "locking" via `useRef` to prevent concurrent API calls (e.g., `isValidatingRef`) can cause stale data if it blocks subsequent state updates during the lock period.
**Action:** Use `AbortController` in `useEffect` cleanup to cancel stale requests and allow new ones to proceed immediately, ensuring the UI always reflects the latest state.
