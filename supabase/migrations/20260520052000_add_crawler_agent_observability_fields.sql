ALTER TABLE public.crawler_logs
  ADD COLUMN IF NOT EXISTS host text,
  ADD COLUMN IF NOT EXISTS agent_family text,
  ADD COLUMN IF NOT EXISTS cache_outcome text;

CREATE INDEX IF NOT EXISTS idx_crawler_logs_merchant_crawled_at
  ON public.crawler_logs (merchant_id, crawled_at DESC);

CREATE INDEX IF NOT EXISTS idx_crawler_logs_agent_family
  ON public.crawler_logs (agent_family);

CREATE INDEX IF NOT EXISTS idx_crawler_logs_host
  ON public.crawler_logs (host);

DROP POLICY IF EXISTS "Staff can view crawler agent observability logs"
  ON public.crawler_logs;

CREATE POLICY "Staff can view crawler agent observability logs"
  ON public.crawler_logs
  FOR SELECT
  USING (public.has_merchant_access(merchant_id));

COMMENT ON COLUMN public.crawler_logs.host IS
  'Storefront host seen by the crawler or agent request.';

COMMENT ON COLUMN public.crawler_logs.agent_family IS
  'Normalized crawler or AI-agent family such as openai, google, anthropic, perplexity, search, or generic-agent.';

COMMENT ON COLUMN public.crawler_logs.cache_outcome IS
  'Observed cache outcome for the crawler response: hit, miss, stale, bypass, or unknown.';
