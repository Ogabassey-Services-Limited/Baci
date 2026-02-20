## 2026-05-22 - [Auth Store] Missing Cleanup on Session Expiry
**Learning:** `resetUserStores()` was only called on `SIGNED_IN` or explicit `signOut()`, missing the `SIGNED_OUT` event from Supabase (session expiry). This left sensitive user data in RevenueCat/Settings stores while the app appeared logged out.
**Action:** Always listen for `SIGNED_OUT` in `onAuthStateChange` to trigger cleanup, ensuring data sovereignty even during passive session expiry.
