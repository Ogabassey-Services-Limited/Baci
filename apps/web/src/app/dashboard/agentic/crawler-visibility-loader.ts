import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type CrawlerLogSummary,
  type CrawlerLogSummaryRow,
  createCrawlerLogSummaryAccumulator,
} from '@/lib/agentic/crawler-observability';

const CRAWLER_VISIBILITY_WINDOW_DAYS = 14;
const CRAWLER_LOG_PAGE_SIZE = 1000;
const CRAWLER_LOG_MAX_PAGES = 10;
const CRAWLER_RECENT_ACTIVITY_LIMIT = 3;
const CRAWLER_LOG_SELECT_COLUMNS =
  'id, agent_family, bot_name, cache_outcome, crawled_at, host, response_time_ms, status_code, url_path, user_agent';

type CrawlerLogQueryRow = CrawlerLogSummaryRow & { id: string };

interface CrawlerLogCursor {
  crawledAt: string;
  id: string;
}

function toCrawlerLogSummaryRow(row: CrawlerLogQueryRow): CrawlerLogSummaryRow {
  return {
    agent_family: row.agent_family,
    bot_name: row.bot_name,
    cache_outcome: row.cache_outcome,
    crawled_at: row.crawled_at,
    host: row.host,
    response_time_ms: row.response_time_ms,
    status_code: row.status_code,
    url_path: row.url_path,
    user_agent: row.user_agent,
  };
}

function buildCursorFilter(cursor: CrawlerLogCursor) {
  return `crawled_at.lt.${cursor.crawledAt},and(crawled_at.eq.${cursor.crawledAt},id.lt.${cursor.id})`;
}

async function hasRowsAfterCursor({
  crawledSince,
  crawledUntil,
  cursor,
  merchantId,
  supabase,
}: {
  crawledSince: string;
  crawledUntil: string;
  cursor: CrawlerLogCursor;
  merchantId: string;
  supabase: SupabaseClient;
}): Promise<boolean> {
  const { data, error } = await supabase
    .from('crawler_logs')
    .select('id')
    .eq('merchant_id', merchantId)
    .gte('crawled_at', crawledSince)
    .lte('crawled_at', crawledUntil)
    .order('crawled_at', { ascending: false })
    .order('id', { ascending: false })
    .or(buildCursorFilter(cursor))
    .limit(1);

  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function loadAgenticCrawlerVisibility(
  supabase: SupabaseClient,
  merchantId: string
): Promise<CrawlerLogSummary> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - CRAWLER_VISIBILITY_WINDOW_DAYS);
  const crawledSince = startDate.toISOString();
  const crawledUntil = new Date().toISOString();
  const accumulator = createCrawlerLogSummaryAccumulator(
    CRAWLER_VISIBILITY_WINDOW_DAYS,
    { recentLimit: CRAWLER_RECENT_ACTIVITY_LIMIT }
  );
  let cursor: CrawlerLogCursor | null = null;
  let isPartial = false;

  for (let page = 0; page < CRAWLER_LOG_MAX_PAGES; page += 1) {
    const query = supabase
      .from('crawler_logs')
      .select(CRAWLER_LOG_SELECT_COLUMNS)
      .eq('merchant_id', merchantId)
      .gte('crawled_at', crawledSince)
      .lte('crawled_at', crawledUntil)
      .order('crawled_at', { ascending: false })
      .order('id', { ascending: false });
    const { data, error } = await (cursor
      ? query.or(buildCursorFilter(cursor))
      : query
    ).limit(CRAWLER_LOG_PAGE_SIZE);

    if (error) throw error;
    const pageRows = (data ?? []) as CrawlerLogQueryRow[];
    accumulator.addRows(pageRows.map(toCrawlerLogSummaryRow));
    if (pageRows.length < CRAWLER_LOG_PAGE_SIZE) break;

    const lastRow = pageRows.at(-1);
    if (!lastRow) break;
    cursor = { crawledAt: lastRow.crawled_at, id: lastRow.id };
    if (page === CRAWLER_LOG_MAX_PAGES - 1) {
      isPartial = await hasRowsAfterCursor({
        crawledSince,
        crawledUntil,
        cursor,
        merchantId,
        supabase,
      });
    }
  }

  return { ...accumulator.toSummary(), isPartial };
}
