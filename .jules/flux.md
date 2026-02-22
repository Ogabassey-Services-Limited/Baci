## 2026-02-18 - Cart State Race Condition & Stale Data
**Learning:**
1. Stale Data: React Context providers (like `CartProvider`) must expose a cleanup/reset method and be explicitly called during global events like logout, especially if they are not unmounted (e.g., persistent layouts).
2. Scope Loss: `clearCart()` methods should differentiate between "emptying items" and "resetting configuration". Clearing `merchantSlug` in a scoped storefront caused subsequent writes to default to a guest cart, leading to apparent data loss on refresh.

**Action:**
1. Always expose `clear()` methods in global stores/contexts.
2. In `logout` flows, systematically call `clear()` on all persistent stores.
3. Ensure `clear()` logic respects initialization props (e.g., `initialMerchantSlug`) to prevent context loss.

## 2026-02-15 - Cart Validation Race Condition
**Learning:** Manual "locking" via `useRef` to prevent concurrent API calls (e.g., `isValidatingRef`) can cause stale data if it blocks subsequent state updates during the lock period.
**Action:** Use `AbortController` in `useEffect` cleanup to cancel stale requests and allow new ones to proceed immediately, ensuring the UI always reflects the latest state.
