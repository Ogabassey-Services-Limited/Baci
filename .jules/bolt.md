## 2026-02-28 - Optimize Staff Member Fetches
**Learning:** Replaced `select('*')` with explicit column selections in `apps/web/src/app/api/staff/route.ts` and `apps/web/src/app/api/staff/[id]/route.ts` to reduce database load and network transfer payload, particularly avoiding fetching unnecessary sensitive columns like `invitation_token` when not needed.
**Action:** Always select specific required columns instead of `*` when querying Supabase to minimize payload size and improve database performance.
