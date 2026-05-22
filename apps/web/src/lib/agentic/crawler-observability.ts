import { stripPort } from '@/lib/storefront-host';
import type { CrawlerLogPostInput } from '@/schemas/crawler-observability';

export type AgentCrawlerFamily =
  | 'anthropic'
  | 'generic-agent'
  | 'google'
  | 'meta'
  | 'openai'
  | 'perplexity'
  | 'search'
  | 'unknown';

export interface CrawlerClassification {
  botName: string;
  family: AgentCrawlerFamily;
  isAiAgent: boolean;
}

export interface CrawlerLogSummaryRow {
  agent_family?: string | null;
  bot_name: string | null;
  cache_outcome?: string | null;
  crawled_at: string;
  host?: string | null;
  response_time_ms: number | null;
  status_code: number | null;
  url_path: string;
  user_agent: string | null;
}

export interface CrawlerLogSummary {
  byBot: Array<{
    count: number;
    family: string;
    lastCrawledAt: string;
    name: string;
  }>;
  byDay: Array<{ count: number; date: string }>;
  generatedAt: string;
  health: {
    aiAgentCrawls: number;
    cacheMissCrawls: number;
    failedCrawls: number;
    lastAgentCrawlAt: string | null;
    slowCrawls: number;
  };
  isPartial: boolean;
  recent: CrawlerLogSummaryRow[];
  topPages: Array<{ count: number; path: string }>;
  totalCrawls: number;
  windowDays: number;
}

export interface CrawlerLogSummaryAccumulator {
  addRows(rows: CrawlerLogSummaryRow[]): void;
  toSummary(): CrawlerLogSummary;
}

const AI_AGENT_FAMILIES: ReadonlySet<AgentCrawlerFamily> = new Set([
  'anthropic',
  'generic-agent',
  'google',
  'openai',
  'perplexity',
]);

const CONTROL_CHARS_REGEX = /[\r\n\t]/g;
const FULL_URL_REGEX = /^https?:\/\//i;
const SLOW_RESPONSE_MS = 2500;

const CLASSIFIERS: Array<{
  botName: string;
  family: AgentCrawlerFamily;
  isAiAgent: boolean;
  pattern: RegExp;
}> = [
  {
    botName: 'OpenAI',
    family: 'openai',
    isAiAgent: true,
    pattern: /gptbot|chatgpt-user|oai-searchbot|openai/i,
  },
  {
    botName: 'Google',
    family: 'google',
    isAiAgent: true,
    pattern:
      /google-extended|googlebot|googleother|gemini|google-inspectiontool/i,
  },
  {
    botName: 'Anthropic',
    family: 'anthropic',
    isAiAgent: true,
    pattern: /claudebot|claude-user|claude-searchbot|anthropic-ai|claude-web/i,
  },
  {
    botName: 'Perplexity',
    family: 'perplexity',
    isAiAgent: true,
    pattern: /perplexitybot|perplexity/i,
  },
  {
    botName: 'Meta',
    family: 'meta',
    isAiAgent: false,
    pattern: /meta-externalagent|facebookexternalhit/i,
  },
  {
    botName: 'Search crawler',
    family: 'search',
    isAiAgent: false,
    pattern: /bingbot|duckduckbot|baiduspider|yandexbot|slurp/i,
  },
  {
    botName: 'Generic agent',
    family: 'generic-agent',
    isAiAgent: true,
    pattern: /agent|bot|crawler|spider|scraper/i,
  },
];

export function classifyCrawlerUserAgent(
  userAgent: string | null | undefined
): CrawlerClassification {
  const normalized = userAgent?.trim() ?? '';

  for (const classifier of CLASSIFIERS) {
    if (classifier.pattern.test(normalized)) {
      return {
        botName: classifier.botName,
        family: classifier.family,
        isAiAgent: classifier.isAiAgent,
      };
    }
  }

  return {
    botName: normalized ? 'Unknown crawler' : 'Unknown',
    family: 'unknown',
    isAiAgent: false,
  };
}

export function normalizeCrawlerHost(host: string | null | undefined) {
  const normalized =
    host
      ?.split(',')[0]
      ?.trim()
      .replace(FULL_URL_REGEX, '')
      .replace(/\/.*$/, '')
      .toLowerCase() ?? '';

  const withoutPort = stripPort(normalized).replace(CONTROL_CHARS_REGEX, ' ');
  return withoutPort.length > 0 ? withoutPort.slice(0, 255) : null;
}

export function normalizeCrawlerPath(rawPath: string) {
  const value = rawPath.trim().replace(CONTROL_CHARS_REGEX, ' ');

  if (FULL_URL_REGEX.test(value)) {
    try {
      const parsed = new URL(value);
      return `${parsed.pathname}${parsed.search}`.slice(0, 500);
    } catch {
      return '/'.slice(0, 500);
    }
  }

  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.slice(0, 500);
}

export function getCrawlerClassificationForEvent(
  event: Pick<CrawlerLogPostInput, 'botName' | 'userAgent'>
) {
  const classification = classifyCrawlerUserAgent(
    event.userAgent ?? event.botName
  );

  return {
    ...classification,
    botName: event.botName?.trim() || classification.botName,
  };
}

export function buildCrawlerLogSummary(
  rows: CrawlerLogSummaryRow[],
  windowDays: number
): CrawlerLogSummary {
  const accumulator = createCrawlerLogSummaryAccumulator(windowDays);
  accumulator.addRows(rows);
  return accumulator.toSummary();
}

export function createCrawlerLogSummaryAccumulator(
  windowDays: number,
  options: { recentLimit?: number } = {}
): CrawlerLogSummaryAccumulator {
  const botStats = new Map<
    string,
    { count: number; family: string; lastCrawledAt: string; name: string }
  >();
  const pageCounts = new Map<string, number>();
  const dailyCounts = new Map<string, number>();
  const recentRows: CrawlerLogSummaryRow[] = [];
  let aiAgentCrawls = 0;
  let cacheMissCrawls = 0;
  let failedCrawls = 0;
  let lastAgentCrawlAt: string | null = null;
  let slowCrawls = 0;
  let totalCrawls = 0;

  const addRow = (row: CrawlerLogSummaryRow) => {
    totalCrawls += 1;
    if (
      options.recentLimit === undefined ||
      recentRows.length < options.recentLimit
    ) {
      recentRows.push(row);
    }

    const fallbackClassification = classifyCrawlerUserAgent(
      row.user_agent ?? row.bot_name
    );
    const family =
      typeof row.agent_family === 'string' && row.agent_family.length > 0
        ? row.agent_family
        : fallbackClassification.family;
    const name =
      row.bot_name?.trim() || classifyCrawlerUserAgent(row.user_agent).botName;
    const key = `${family}:${name}`;
    const previous = botStats.get(key);

    botStats.set(key, {
      count: (previous?.count ?? 0) + 1,
      family,
      lastCrawledAt:
        previous && previous.lastCrawledAt > row.crawled_at
          ? previous.lastCrawledAt
          : row.crawled_at,
      name,
    });

    const normalizedPath = normalizeCrawlerPath(row.url_path).split('?')[0];
    pageCounts.set(normalizedPath, (pageCounts.get(normalizedPath) ?? 0) + 1);

    const day = row.crawled_at.split('T')[0] ?? row.crawled_at;
    dailyCounts.set(day, (dailyCounts.get(day) ?? 0) + 1);

    if (AI_AGENT_FAMILIES.has(family as AgentCrawlerFamily)) {
      aiAgentCrawls += 1;
      if (!lastAgentCrawlAt || row.crawled_at > lastAgentCrawlAt) {
        lastAgentCrawlAt = row.crawled_at;
      }
    }

    if (row.status_code !== null && row.status_code >= 400) {
      failedCrawls += 1;
    }

    if (
      row.response_time_ms !== null &&
      row.response_time_ms >= SLOW_RESPONSE_MS
    ) {
      slowCrawls += 1;
    }

    if (
      row.cache_outcome === 'miss' ||
      row.cache_outcome === 'bypass' ||
      row.cache_outcome === 'stale'
    ) {
      cacheMissCrawls += 1;
    }
  };

  return {
    addRows(rowsToAdd) {
      for (const row of rowsToAdd) {
        addRow(row);
      }
    },
    toSummary() {
      return {
        byBot: Array.from(botStats.values()).sort((left, right) => {
          if (right.count !== left.count) return right.count - left.count;
          return left.name.localeCompare(right.name);
        }),
        byDay: Array.from(dailyCounts.entries())
          .map(([date, count]) => ({ count, date }))
          .sort((left, right) => left.date.localeCompare(right.date)),
        generatedAt: new Date().toISOString(),
        health: {
          aiAgentCrawls,
          cacheMissCrawls,
          failedCrawls,
          lastAgentCrawlAt,
          slowCrawls,
        },
        isPartial: false,
        recent: recentRows.slice(),
        topPages: Array.from(pageCounts.entries())
          .map(([path, count]) => ({ count, path }))
          .sort((left, right) => {
            if (right.count !== left.count) return right.count - left.count;
            return left.path.localeCompare(right.path);
          })
          .slice(0, 20),
        totalCrawls,
        windowDays,
      };
    },
  };
}
