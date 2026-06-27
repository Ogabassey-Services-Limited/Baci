import { getMyCoverSecretKey } from '@/env';
import type { MyCoverPolicyLookup, MyCoverWebhookData } from './webhook-types';

const MYCOVER_RENEWAL_DETAILS_URL = 'https://v2.api.mycover.ai/v2/purchases';

export function getPolicyId(data: MyCoverWebhookData) {
  return (
    data.essential?.policy_id ||
    data.meta?.policy_id ||
    data.policy_id ||
    data.id
  );
}

export function getExplicitPolicyId(data: MyCoverWebhookData) {
  return (
    data.essential?.policy_id || data.meta?.policy_id || data.policy_id || null
  );
}

export function getPolicyNumber(data: MyCoverWebhookData) {
  return data.essential?.policy_number || data.policy_number;
}

export function getCertificateUrl(data: MyCoverWebhookData) {
  return data.essential?.certificate_url || data.certificate_url;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isTruthyMyCoverFlag(value: unknown): boolean {
  return (
    value === true ||
    value === 1 ||
    (typeof value === 'string' &&
      ['1', 'true', 'yes'].includes(value.trim().toLowerCase()))
  );
}

export function isPreLossInspectionApproved(data: MyCoverWebhookData) {
  const essential = asRecord(data.essential);
  const meta = asRecord(data.meta);
  const topLevel = asRecord(data);
  return (
    isTruthyMyCoverFlag(essential.is_approved) ||
    isTruthyMyCoverFlag(meta.is_approved) ||
    isTruthyMyCoverFlag(topLevel.is_approved)
  );
}

function readString(
  sources: readonly Record<string, unknown>[],
  keys: readonly string[]
): string | null {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
  }

  return null;
}

export function getLookupFromRenewalDetails(
  response: unknown
): MyCoverPolicyLookup | null {
  const data = asRecord(asRecord(response).data);
  const policy = asRecord(data.policy);
  const purchase = asRecord(data.purchase);

  const policyId =
    readString([data], ['policy_id', 'mycover_policy_id']) ??
    readString([policy], ['id', 'policy_id']);
  if (policyId) {
    return { column: 'mycover_policy_id', value: policyId };
  }

  const purchaseId =
    readString([data], ['purchase_id', 'mycover_purchase_id', 'id']) ??
    readString([purchase], ['id', 'purchase_id']);
  if (purchaseId) {
    return { column: 'mycover_purchase_id', value: purchaseId };
  }

  return null;
}

export async function resolveRenewalPolicyLookup(
  renewalId: string,
  configuredSecret: string
): Promise<MyCoverPolicyLookup | null> {
  const secretKey = getMyCoverSecretKey() || configuredSecret.trim();
  if (!secretKey) return null;

  const response = await fetch(
    `${MYCOVER_RENEWAL_DETAILS_URL}/${encodeURIComponent(renewalId)}`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${secretKey}`,
      },
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to resolve MyCover renewal details');
  }

  return getLookupFromRenewalDetails(await response.json());
}

export function getPolicyLookup(
  data: MyCoverWebhookData,
  {
    dataIdColumn = 'mycover_policy_id',
  }: {
    dataIdColumn?: MyCoverPolicyLookup['column'] | null;
  } = {}
): MyCoverPolicyLookup | null {
  const policyId =
    data.essential?.policy_id || data.meta?.policy_id || data.policy_id;
  if (policyId) {
    return { column: 'mycover_policy_id', value: policyId };
  }

  if (data.purchase_id) {
    return { column: 'mycover_purchase_id', value: data.purchase_id };
  }

  if (!(data.id && dataIdColumn)) {
    return null;
  }

  return {
    column: dataIdColumn,
    value: data.id,
  };
}

export function getPolicyStartDate(data: MyCoverWebhookData) {
  return (
    data.essential?.start_date || data.start_date || data.policy_start_date
  );
}

export function getPolicyExpiryDate(data: MyCoverWebhookData) {
  return (
    data.essential?.expiration_date ||
    data.expiration_date ||
    data.policy_expiry_date
  );
}
