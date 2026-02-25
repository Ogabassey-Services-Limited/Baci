## 2026-02-15 - Cart Validation Race Condition
**Learning:** Manual "locking" via `useRef` to prevent concurrent API calls (e.g., `isValidatingRef`) can cause stale data if it blocks subsequent state updates during the lock period.
**Action:** Use `AbortController` in `useEffect` cleanup to cancel stale requests and allow new ones to proceed immediately, ensuring the UI always reflects the latest state.

## 2026-02-15 - Guest Cart Overwrite Race Condition
**Learning:** Hydrating state from persistent storage (localStorage) based on authentication props (`initialUserId`) must account for the transition from guest to authenticated state. Specifically, blindly overwriting the in-memory state with the authenticated user's stored data can discard valuable guest session data (e.g., items added before login).
**Action:** Implement a merge strategy during hydration: if transitioning from guest to user, check for existing guest data in storage, merge it into the user's data, and clear the guest storage to prevent duplication.
