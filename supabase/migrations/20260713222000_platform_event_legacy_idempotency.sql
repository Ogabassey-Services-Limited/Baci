-- PostgREST upserts name conflict columns but cannot target a partial unique
-- index without its predicate. PostgreSQL unique indexes already treat NULL
-- values as distinct, so a full key preserves the intended historical
-- behavior while allowing legacy platform retries to use ON CONFLICT safely.

DROP INDEX IF EXISTS public.platform_events_type_event_id_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS platform_events_type_event_id_uidx
  ON public.platform_events (event_type, event_id);
