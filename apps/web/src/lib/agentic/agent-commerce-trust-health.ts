import { z } from 'zod';
import { STOREFRONT_AGENT_ROUTES } from '@/config/storefront-agent-routes';
import { buildStoreUrl } from '@/lib/store-url';
import type { AgenticAction } from '@/schemas/agentic-action-health';

// agent-trust.json can miss Vercel cache during the cron and still be healthy;
// keep this below the cron maxDuration but above normal cold storefront latency.
export const TRUST_FETCH_TIMEOUT_MS = 15_000;

type AgentCommerceTrustHealthStatus = 'attention' | 'monitor' | 'ok';

export type AgentCommerceTrustHealthIssueCode =
  | 'trust_check_failed'
  | 'trust_check_warning'
  | 'trust_contract_drift'
  | 'trust_invalid_json'
  | 'trust_unavailable';

export interface AgentCommerceTrustHealthIssue {
  check_id?: string;
  code: AgentCommerceTrustHealthIssueCode;
  count: number;
  message: string;
  severity: Exclude<AgenticAction['severity'], 'ok'>;
}

export interface AgentCommerceTrustHealthResult {
  issue_count: number;
  issues: AgentCommerceTrustHealthIssue[];
  status: AgentCommerceTrustHealthStatus;
  url: string;
}

interface TrustHealthMerchant {
  custom_domain?: string | null;
  slug: string;
}

const trustDocumentSchema = z.object({
  store: z.object({
    canonical_origin: z.string(),
    slug: z.string(),
  }),
  trust: z.object({
    checks: z
      .array(
        z.object({
          affectedProductCount: z.number().int().nonnegative().optional(),
          affectedProductIds: z.array(z.string()).optional(),
          id: z.string().min(1),
          message: z.string().min(1),
          severity: z.enum(['pass', 'warn', 'fail']),
        })
      )
      .min(1),
    status: z.enum(['pass', 'warn', 'fail']),
  }),
});

type ParsedTrustDocument = z.infer<typeof trustDocumentSchema>;

function buildAgentCommerceTrustHealthTarget(merchant: TrustHealthMerchant): {
  baseUrl: string;
  url: string;
} {
  const baseUrl = buildStoreUrl({
    custom_domain: merchant.custom_domain ?? undefined,
    slug: merchant.slug,
  });

  return {
    baseUrl,
    url: new URL(STOREFRONT_AGENT_ROUTES.trust, baseUrl).toString(),
  };
}

function createContractIssue(message: string): AgentCommerceTrustHealthIssue {
  return {
    code: 'trust_contract_drift',
    count: 1,
    message,
    severity: 'attention',
  };
}

function createIssueResult(
  url: string,
  issue: AgentCommerceTrustHealthIssue
): AgentCommerceTrustHealthResult {
  return {
    issue_count: 1,
    issues: [issue],
    status: 'attention',
    url,
  };
}

function getCheckIssueCount(
  check: ParsedTrustDocument['trust']['checks'][number]
) {
  return Math.max(
    1,
    check.affectedProductCount ?? check.affectedProductIds?.length ?? 1
  );
}

function getReadinessStatus(
  checks: ParsedTrustDocument['trust']['checks']
): ParsedTrustDocument['trust']['status'] {
  if (checks.some((check) => check.severity === 'fail')) return 'fail';
  if (checks.some((check) => check.severity === 'warn')) return 'warn';
  return 'pass';
}

export function validateAgentCommerceTrustHealth({
  expectedOrigin,
  expectedSlug,
  trustDocument,
  url,
}: {
  expectedOrigin: string;
  expectedSlug: string;
  trustDocument: unknown;
  url: string;
}): AgentCommerceTrustHealthResult {
  const parsed = trustDocumentSchema.safeParse(trustDocument);
  if (!parsed.success) {
    return createIssueResult(
      url,
      createContractIssue(
        'Trust readiness response does not match the public contract.'
      )
    );
  }

  const issues: AgentCommerceTrustHealthIssue[] = [];
  const document = parsed.data;

  if (document.store.slug !== expectedSlug) {
    issues.push(
      createContractIssue('Trust readiness store slug is not scoped.')
    );
  }
  if (document.store.canonical_origin !== expectedOrigin) {
    issues.push(
      createContractIssue(
        'Trust readiness canonical origin does not match its storefront URL.'
      )
    );
  }

  for (const check of document.trust.checks) {
    if (check.severity === 'pass') continue;

    issues.push({
      check_id: check.id,
      code:
        check.severity === 'fail'
          ? 'trust_check_failed'
          : 'trust_check_warning',
      count: getCheckIssueCount(check),
      message: check.message,
      severity: check.severity === 'fail' ? 'attention' : 'monitor',
    });
  }

  if (getReadinessStatus(document.trust.checks) !== document.trust.status) {
    issues.push(
      createContractIssue(
        'Trust readiness aggregate status does not match its check severities.'
      )
    );
  }

  return {
    issue_count: issues.length,
    issues,
    status: issues.some((issue) => issue.severity === 'attention')
      ? 'attention'
      : issues.length > 0
        ? 'monitor'
        : 'ok',
    url,
  };
}

export async function checkAgentCommerceTrustHealth(
  merchant: TrustHealthMerchant,
  fetcher: typeof fetch = fetch
): Promise<AgentCommerceTrustHealthResult> {
  const { baseUrl, url } = buildAgentCommerceTrustHealthTarget(merchant);

  try {
    const response = await fetcher(url, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TRUST_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return createIssueResult(url, {
        code: 'trust_unavailable',
        count: 1,
        message: `Trust readiness returned HTTP ${response.status}.`,
        severity: 'attention',
      });
    }

    let trustDocument: unknown;
    try {
      trustDocument = await response.json();
    } catch (_error) {
      return createIssueResult(url, {
        code: 'trust_invalid_json',
        count: 1,
        message: 'Trust readiness response is not valid JSON.',
        severity: 'attention',
      });
    }

    return validateAgentCommerceTrustHealth({
      expectedOrigin: baseUrl,
      expectedSlug: merchant.slug,
      trustDocument,
      url,
    });
  } catch (_error) {
    return createIssueResult(url, {
      code: 'trust_unavailable',
      count: 1,
      message: 'Trust readiness could not be fetched.',
      severity: 'attention',
    });
  }
}

function getTrustActionCode(trust: AgentCommerceTrustHealthResult) {
  if (
    trust.issues.some(
      (issue) =>
        issue.code === 'trust_unavailable' ||
        issue.code === 'trust_invalid_json'
    )
  ) {
    return 'AGENT_COMMERCE_TRUST_UNAVAILABLE';
  }
  if (trust.issues.some((issue) => issue.code === 'trust_contract_drift')) {
    return 'AGENT_COMMERCE_TRUST_CONTRACT_DRIFT';
  }
  return trust.status === 'attention'
    ? 'AGENT_COMMERCE_TRUST_FAILED'
    : 'AGENT_COMMERCE_TRUST_WARNING';
}

export function buildAgentCommerceTrustHealthActions(
  trust: AgentCommerceTrustHealthResult
): AgenticAction[] {
  if (trust.status === 'ok') return [];

  const actionCode = getTrustActionCode(trust);
  const actionMessages: Record<string, string> = {
    AGENT_COMMERCE_TRUST_CONTRACT_DRIFT:
      'The public agent trust readiness contract has drifted.',
    AGENT_COMMERCE_TRUST_FAILED:
      'Public agent trust readiness reports failed checks.',
    AGENT_COMMERCE_TRUST_UNAVAILABLE:
      'Public agent trust readiness could not be loaded.',
    AGENT_COMMERCE_TRUST_WARNING:
      'Public agent trust readiness reports checks to monitor.',
  };

  return [
    {
      code: actionCode,
      count: Math.max(
        1,
        trust.issues.reduce((total, issue) => total + issue.count, 0)
      ),
      message: actionMessages[actionCode],
      next_step:
        'Open Agentic Commerce and resolve public trust readiness checks before expanding agent traffic.',
      next_step_url: '/dashboard/agentic',
      severity: trust.status === 'attention' ? 'attention' : 'monitor',
    },
  ];
}

export function getAgentCommerceTrustStatusReason(
  trust: AgentCommerceTrustHealthResult,
  fallbackReason: string
) {
  if (trust.status === 'ok') return fallbackReason;
  if (
    trust.status === 'monitor' &&
    fallbackReason !== 'agentic_action_health_ok' &&
    fallbackReason !== 'agentic_action_health_monitor'
  ) {
    return fallbackReason;
  }

  return getTrustActionCode(trust).toLowerCase();
}
