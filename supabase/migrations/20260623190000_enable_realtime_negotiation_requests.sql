-- Enable Supabase Realtime for public.negotiation_requests.
--
-- The admin app (apps/mobile-admin/app/(admin)/negotiations.tsx) subscribes to
-- postgres_changes INSERT events on this table, filtered by merchant_id, to
-- live-refresh the merchant's negotiation review queue. That subscription only
-- fires when the table is part of the `supabase_realtime` publication — it was
-- not, so new review-needed negotiations never updated the screen in real time
-- (the merchant had to manually re-open / pull-to-refresh the tab).
--
-- INSERT events ship the full new row, so the default replica identity (primary
-- key) is sufficient; no REPLICA IDENTITY FULL change is required.
--
-- Idempotent: skip if the table is already in the publication.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'negotiation_requests'
  ) then
    alter publication supabase_realtime add table public.negotiation_requests;
  end if;
end $$;
