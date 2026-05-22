import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgenticAction } from '@/schemas/agentic-action-health';
import type { AgentCommerceManifestHealthResult } from './agent-commerce-manifest-health';

const DOMAIN_SELECT_COLUMNS = 'merchant_id, domain';

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

export function getAgentCommerceManifestStatusReason(
  manifest: AgentCommerceManifestHealthResult,
  fallbackReason: string
) {
  if (manifest.status !== 'attention') return fallbackReason;

  return manifest.issues.some((issue) => issue.code === 'manifest_unavailable')
    ? 'agent_commerce_manifest_unavailable'
    : 'agent_commerce_manifest_drift';
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
