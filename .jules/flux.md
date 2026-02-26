## 2026-02-15 - Cart Validation Race Condition
**Learning:** Manual "locking" via `useRef` to prevent concurrent API calls (e.g., `isValidatingRef`) can cause stale data if it blocks subsequent state updates during the lock period.
**Action:** Use `AbortController` in `useEffect` cleanup to cancel stale requests and allow new ones to proceed immediately, ensuring the UI always reflects the latest state.

## 2026-02-18 - Cross-Tab State Synchronization
**Learning:** `localStorage` changes do not automatically trigger re-renders in React components across tabs/windows. This leads to stale data and potential race conditions when users interact with the app in multiple tabs.
**Action:** Implement `window.addEventListener('storage', ...)` in `useEffect` for critical state persisted in `localStorage` (like shopping carts or auth tokens) to ensure all active tabs reflect the latest state.
