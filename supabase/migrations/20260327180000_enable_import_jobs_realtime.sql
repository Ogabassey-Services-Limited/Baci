-- Enable Supabase Realtime on import_jobs for live progress streaming.
-- Guarded to be idempotent: safe to re-run even when the publication is
-- missing (e.g. local dev without Realtime) or the table is already added.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_publication_rel
    WHERE prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
      AND prrelid = 'public.import_jobs'::regclass
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.import_jobs;
  END IF;
END $$;
