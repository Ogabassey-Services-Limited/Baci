import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgenticAction } from '@/schemas/agentic-action-health';
import type { AgentCommerceManifestHealthResult } from './agent-commerce-manifest-health';
import {
  buildCrawlerLogSummary,
  type CrawlerLogSummary,
  type CrawlerLogSummaryRow,
} from './crawler-observability';

const DOMAIN_SELECT_COLUMNS = 'merchant_id, domain';
const CRAWLER_LOG_SELECT_COLUMNS =
  'agent_family, bot_name, cache_outcome, crawled_at, host, response_time_ms, status_code, url_path, user_agent';
const CRAWLER_VISIBILITY_RECORD_LIMIT = 1000;
const CRAWLER_VISIBILITY_WINDOW_DAYS = 14;

export type AgenticCommerceHealthStatus = 'attention' | 'monitor' | 'ok';

export interface AgenticCommerceHealthActionSummary {
  code: string;
  count: number;
  severity: AgenticAction['severity'];
}

interface MonitoredDomainRow {
  domain: string | null;
  merchant_id: string | null;
}

type AgentCommerceCrawlerHealthIssueCode =
  | 'crawler_fetch_failures'
  | 'crawler_log_unavailable'
  | 'crawler_slow_responses'
  | 'crawler_visibility_missing';

export interface AgentCommerceCrawlerHealthIssue {
  code: AgentCommerceCrawlerHealthIssueCode;
  count: number;
  message: string;
  severity: Exclude<AgenticAction['severity'], 'ok'>;
}

export interface AgentCommerceCrawlerHealthResult {
  issue_count: number;
  issues: AgentCommerceCrawlerHealthIssue[];
  status: AgenticCommerceHealthStatus;
  summary: CrawlerLogSummary | null;
  window_days: number;
}

export function buildAgentCommerceManifestHealthActions(
  manifest: AgentCommerceManifestHealthResult
): AgenticAction[] {
  if (manifest.status !== 'attention') return [];

  const unavailable = manifest.issues.some(
    (issue) => issue.code === 'manifest_unavailable'
  );

  return [
    {
      code: unavailable
        ? 'AGENT_COMMERCE_MANIFEST_UNAVAILABLE'
        : 'AGENT_COMMERCE_MANIFEST_DRIFT',
      count: Math.max(1, manifest.issue_count),
      message: unavailable
        ? 'The public agent-commerce manifest could not be loaded.'
        : 'The public agent-commerce manifest contract has drifted from advertised capabilities.',
      next_step:
        'Open agent-commerce.json and compare advertised capabilities, auth, links, and payment methods before expanding agent traffic.',
      severity: 'attention',
    },
  ];
}

export function buildAgentCommerceCrawlerHealthActions(
  crawler: AgentCommerceCrawlerHealthResult
): AgenticAction[] {
  return crawler.issues.map((issue) => {
    switch (issue.code) {
      case 'crawler_log_unavailable':
        return {
          code: 'AGENTIC_CRAWLER_VISIBILITY_UNAVAILABLE',
          count: issue.count,
          message: 'Crawler visibility logs could not be loaded.',
          next_step:
            'Check crawler logging storage and permissions before relying on agent visibility metrics.',
          severity: issue.severity,
        };
      case 'crawler_fetch_failures':
        return {
          code: 'AGENTIC_CRAWLER_FETCH_FAILURES',
          count: issue.count,
          message:
            'Crawler visits are receiving failing HTTP status codes on monitored storefront routes.',
          next_step:
            'Review recent crawler logs and fix broken public routes before expanding agent traffic.',
          severity: issue.severity,
        };
      case 'crawler_visibility_missing':
        return {
          code: 'AGENTIC_CRAWLER_VISIBILITY_MISSING',
          count: issue.count,
          message: 'No AI-agent crawler visits were observed recently.',
          next_step:
            'Confirm robots, llms.txt, agent-commerce.json, and feed URLs are discoverable by AI agents.',
          severity: issue.severity,
        };
      case 'crawler_slow_responses':
        return {
          code: 'AGENTIC_CRAWLER_SLOW_RESPONSES',
          count: issue.count,
          message: 'Crawler visits are seeing slow storefront responses.',
          next_step:
            'Inspect slow crawler routes and cache behavior before broad agent promotion.',
          severity: issue.severity,
        };
      default: {
        const unhandledIssueCode: never = issue.code;
        throw new Error(
          `Unhandled crawler health issue: ${unhandledIssueCode}`
        );
      }
    }
  });
}

export function getAgentCommerceManifestStatusReason(
  manifest: AgentCommerceManifestHealthResult,
  fallbackReason: string
) {
  if (manifest.status !== 'attention') return fallbackReason;

  return manifest.issues.some((issue) => issue.code === 'manifest_unavailable')
    ? 'agent_commerce_manifest_unavailable'
    : 'agent_commerce_manifest_drift';
}

export function getAgentCommerceCrawlerStatusReason(
  crawler: AgentCommerceCrawlerHealthResult,
  fallbackReason: string
) {
  if (crawler.status === 'ok') return fallbackReason;

  const priority: AgentCommerceCrawlerHealthIssueCode[] = [
    'crawler_log_unavailable',
    'crawler_fetch_failures',
    'crawler_visibility_missing',
    'crawler_slow_responses',
  ];
  const attentionIssue = priority.find((code) =>
    crawler.issues.some(
      (candidate) =>
        candidate.code === code && candidate.severity === 'attention'
    )
  );

  if (attentionIssue) return `agent_commerce_${attentionIssue}`;
  if (fallbackReason !== 'agentic_action_health_monitor') {
    return fallbackReason;
  }

  const monitorIssue = priority.find((code) =>
    crawler.issues.some(
      (candidate) => candidate.code === code && candidate.severity === 'monitor'
    )
  );

  return monitorIssue ? `agent_commerce_${monitorIssue}` : fallbackReason;
}

export function summarizeAgenticCommerceHealthActions(
  actions: AgenticAction[]
): AgenticCommerceHealthActionSummary[] {
  return actions
    .filter((action) => action.severity !== 'ok' || action.count > 0)
    .map((action) => ({
      code: action.code,
      count: action.count,
      severity: action.severity,
    }));
}

export function getAgenticCommerceHealthStatus(
  actions: AgenticAction[]
): AgenticCommerceHealthStatus {
  if (
    actions.some(
      (action) => action.severity === 'attention' && action.count > 0
    )
  ) {
    return 'attention';
  }

  if (
    actions.some((action) => action.severity === 'monitor' && action.count > 0)
  ) {
    return 'monitor';
  }

  return 'ok';
}

function getCrawlerHealthStatus(
  issues: AgentCommerceCrawlerHealthIssue[]
): AgenticCommerceHealthStatus {
  if (issues.some((issue) => issue.severity === 'attention')) {
    return 'attention';
  }

  return issues.length > 0 ? 'monitor' : 'ok';
}

function buildCrawlerHealthResult(
  summary: CrawlerLogSummary
): AgentCommerceCrawlerHealthResult {
  const issues: AgentCommerceCrawlerHealthIssue[] = [];

  if (summary.health.failedCrawls > 0) {
    issues.push({
      code: 'crawler_fetch_failures',
      count: summary.health.failedCrawls,
      message: 'Crawler visits returned failing HTTP status codes.',
      severity: 'attention',
    });
  }

  if (summary.health.aiAgentCrawls === 0) {
    issues.push({
      code: 'crawler_visibility_missing',
      count: 1,
      message: 'No AI-agent crawler visits were observed recently.',
      severity: 'monitor',
    });
  }

  if (summary.health.slowCrawls > 0) {
    issues.push({
      code: 'crawler_slow_responses',
      count: summary.health.slowCrawls,
      message: 'Crawler visits exceeded the slow-response threshold.',
      severity: 'monitor',
    });
  }

  return {
    issue_count: issues.length,
    issues,
    status: getCrawlerHealthStatus(issues),
    summary,
    window_days: CRAWLER_VISIBILITY_WINDOW_DAYS,
  };
}

export async function checkAgentCommerceCrawlerHealth(
  supabase: SupabaseClient,
  merchantId: string
): Promise<AgentCommerceCrawlerHealthResult> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - CRAWLER_VISIBILITY_WINDOW_DAYS);

  const { data, error } = await supabase
    .from('crawler_logs')
    .select(CRAWLER_LOG_SELECT_COLUMNS)
    .eq('merchant_id', merchantId)
    .gte('crawled_at', startDate.toISOString())
    .order('crawled_at', { ascending: false })
    .limit(CRAWLER_VISIBILITY_RECORD_LIMIT);

  if (error) {
    const issues: AgentCommerceCrawlerHealthIssue[] = [
      {
        code: 'crawler_log_unavailable',
        count: 1,
        message: 'Crawler visibility logs could not be loaded.',
        severity: 'attention',
      },
    ];

    return {
      issue_count: issues.length,
      issues,
      status: 'attention',
      summary: null,
      window_days: CRAWLER_VISIBILITY_WINDOW_DAYS,
    };
  }

  return buildCrawlerHealthResult(
    buildCrawlerLogSummary(
      (data ?? []) as CrawlerLogSummaryRow[],
      CRAWLER_VISIBILITY_WINDOW_DAYS
    )
  );
}

export async function fetchPrimaryAgenticMerchantDomains(
  supabase: SupabaseClient,
  merchantIds: string[]
): Promise<Map<string, string>> {
  if (merchantIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from('domains')
    .select(DOMAIN_SELECT_COLUMNS)
    .in('merchant_id', merchantIds)
    .eq('is_primary', true)
    .eq('status', 'active');

  if (error) {
    throw error;
  }

  return ((data ?? []) as MonitoredDomainRow[]).reduce(
    (domainsByMerchantId, row) => {
      if (row.merchant_id && row.domain) {
        domainsByMerchantId.set(row.merchant_id, row.domain);
      }
      return domainsByMerchantId;
    },
    new Map<string, string>()
  );
}
