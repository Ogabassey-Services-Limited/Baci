# Local History Drift Archive

These migration files were moved out of `supabase/migrations/` to fix Supabase
CLI history drift for the linked project. Replace `{PROJECT_ID}` with your
actual project ID when documenting environment-specific notes.

Why this archive exists:

- These files were being treated as out-of-order/local-only migrations by
  `supabase db push`.
- Some reuse timestamps that already have canonical migrations in
  `supabase/migrations/`.
- Others use non-standard versions (for example `20251208`) that do not align
  with the tracked remote migration history.

Operational rules:

- Do not move these files back into `supabase/migrations/`.
- Keep active, append-only migrations only in `supabase/migrations/`.

## Recreating archived migrations

- Archived files here are local history artifacts. They may have been applied
  manually in some environments or not applied at all.
- If any logic is still needed, create a new append-only migration with a fresh
  timestamp in `supabase/migrations/` instead of moving files back.
- Before recreating, check conflicts with current schema, dependency order, and
  whether manual schema reconciliation or data backfill steps are required.
- When archiving/recreating, document applied-vs-unrun status for each
  environment.
