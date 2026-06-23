-- disable-transaction

-- The web analytics routes use Supabase upsert with
-- onConflict: 'merchant_id,event_id,event_type'. PostgreSQL requires that
-- conflict target to resolve to a unique index; without it live conversion
-- writes fail with SQLSTATE 42P10 before PostgREST can ignore duplicates.
WITH ranked_analytics_events AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY merchant_id, event_id, event_type
      ORDER BY event_timestamp NULLS LAST, created_at NULLS LAST, id
    ) AS duplicate_rank
  FROM public.analytics_events
  WHERE event_id IS NOT NULL
)
DELETE FROM public.analytics_events AS analytics_events
USING ranked_analytics_events
WHERE analytics_events.id = ranked_analytics_events.id
  AND ranked_analytics_events.duplicate_rank > 1;

-- Build the replacement arbiter under a temporary name first. This avoids
-- dropping an existing valid same-name arbiter before PostgreSQL has finished
-- building the new unique index, and still lets reruns clear an invalid
-- concurrently-built replacement from a previous failed attempt.
DROP INDEX CONCURRENTLY IF EXISTS public.analytics_events_merchant_event_id_type_uidx_next;

CREATE UNIQUE INDEX CONCURRENTLY analytics_events_merchant_event_id_type_uidx_next
  ON public.analytics_events (merchant_id, event_id, event_type);

DROP INDEX CONCURRENTLY IF EXISTS public.analytics_events_merchant_event_id_type_uidx;

ALTER INDEX public.analytics_events_merchant_event_id_type_uidx_next
  RENAME TO analytics_events_merchant_event_id_type_uidx;
