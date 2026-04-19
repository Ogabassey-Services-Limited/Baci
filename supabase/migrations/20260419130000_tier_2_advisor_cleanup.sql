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

-- favicons — used only via getPublicUrl from lib/favicon-processor.ts.
-- Actual policy name is "Public read access for favicons" (created in
-- 20251201000001_create_favicons_bucket.sql line 49). The earlier draft of
-- this migration dropped the wrong name ("Favicons are publicly accessible"),
-- which silently left the broad listing policy in place on fresh envs —
-- detected in code review (PR #1292 P1).
DROP POLICY IF EXISTS "Public read access for favicons" ON storage.objects;
-- Keep the old incorrect name as a no-op drop in case a non-archived env has
-- it under that name; harmless if nothing matches.
DROP POLICY IF EXISTS "Favicons are publicly accessible" ON storage.objects;

-- hero-images — had two redundant broad-SELECT policies; drop both.
-- Discovery happens via public.ai_hero_images DB table, not via bucket listing.
-- "Public can view hero images" from 20251124053500_create_images_buckets.sql:41
-- "Public read access for hero images" from 20251130100001_hero_images_storage.sql:17
-- The earlier draft used the wrong name "Hero images are publicly accessible";
-- keep that as a defensive no-op drop.
DROP POLICY IF EXISTS "Public read access for hero images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view hero images" ON storage.objects;
DROP POLICY IF EXISTS "Hero images are publicly accessible" ON storage.objects;

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
