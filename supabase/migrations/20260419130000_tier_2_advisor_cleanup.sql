-- Tier 2 Supabase advisor cleanup: tighten `public_bucket_allows_listing`.
--
-- Supabase's linter flags public storage buckets whose broad `SELECT` policy on
-- `storage.objects` lets any client `supabase.storage.from(...).list(...)` and
-- enumerate every file. Public URL access via `getPublicUrl()` does not require
-- this policy — it goes through Supabase's CDN gateway and works regardless of
-- `storage.objects` RLS.
--
-- Audit (see PR description): only one bucket currently has an active `.list()`
-- caller in the repo — `media`, via `/apps/web/src/app/api/media/route.ts:76`
-- for the merchant media library. The other four public buckets have no
-- listing callers, so their broad SELECT policies can be dropped safely.
--
-- This migration is a no-op on prod (the five policies were already dropped
-- via `execute_sql` before this PR was opened) and carries the same DDL so
-- fresh `supabase db reset` rebuilds end up in the same state.

-- favicons — used only via getPublicUrl from lib/favicon-processor.ts
DROP POLICY IF EXISTS "Favicons are publicly accessible" ON storage.objects;

-- hero-images — had two redundant broad-SELECT policies; drop both.
-- Discovery happens via public.ai_hero_images DB table, not via bucket listing.
DROP POLICY IF EXISTS "Hero images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public can view hero images" ON storage.objects;

-- images — temp storage during Imagen3 generation; consumed by known paths.
DROP POLICY IF EXISTS "Public can view images" ON storage.objects;

-- merchant-assets — no listing callers in the codebase.
DROP POLICY IF EXISTS "Public can view merchant-assets" ON storage.objects;

-- NOTE: `media` intentionally retains its broad "Public can view media files"
-- policy. `/api/media` (merchant-authenticated) calls
-- `supabase.storage.from('media').list(merchantFolder, {...})` and would
-- return empty listings without the policy. Tightening that bucket requires
-- scoping the SELECT policy to authenticated merchants (rather than dropping
-- it outright) and is a separate piece of work.
