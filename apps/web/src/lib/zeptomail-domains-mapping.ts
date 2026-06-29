import 'server-only';

import { getZeptoMailAgentKey } from '@/env';

/**
 * ZeptoMail Domains API response normalization: maps the provider's raw domain
 * payloads into the app's SendingDomainState (DNS records + verification status
 * + mail-agent association). Pure mapping — no network/transport here.
 */

export interface ZeptomailDnsRecord {
  type: 'TXT' | 'CNAME';
  host: string;
  value: string;
}

export interface SendingDomainState {
  domainKey: string;
  domain: string;
  status: 'pending' | 'verified' | 'failed';
  verified: boolean;
  records: ZeptomailDnsRecord[];
  associatedMailagentKeys: string[];
}

export interface ZeptomailDomainData {
  domain_name: string;
  domain_key: string;
  status?: string;
  domain_status?: string;
  associated_mailagents?: Array<
    | string
    | {
        mailagent_key?: string;
        mailagentKey?: string;
        key?: string;
      }
  >;
  mailagent_keys?: string[];
  dkim?: {
    host?: string;
    public_key?: string;
    selector?: string;
    status?: string;
  };
  cname?: { host?: string; cname_record?: string; status?: string };
}

export interface ZeptomailDomainsResponse {
  data?: ZeptomailDomainData | ZeptomailDomainData[];
  message?: string;
}

export function domainRows(json: unknown): ZeptomailDomainData[] {
  const data = (json as ZeptomailDomainsResponse | null)?.data;
  if (!data) {
    return [];
  }
  return Array.isArray(data) ? data : [data];
}

export function firstDomain(json: unknown): ZeptomailDomainData {
  const data = domainRows(json);
  if (!data.length) {
    throw new Error('ZeptoMail returned no domain data');
  }
  return data[0];
}

function extractAssociatedMailagentKeys(data: ZeptomailDomainData): string[] {
  const keys = new Set<string>();
  for (const key of data.mailagent_keys ?? []) {
    if (key) keys.add(key);
  }
  for (const agent of data.associated_mailagents ?? []) {
    if (typeof agent === 'string') {
      keys.add(agent);
      continue;
    }
    const key = agent.mailagent_key ?? agent.mailagentKey ?? agent.key;
    if (key) keys.add(key);
  }
  return [...keys];
}

function toVerificationStatus(
  data: ZeptomailDomainData,
  verified: boolean
): SendingDomainState['status'] {
  if (verified) {
    return 'verified';
  }
  const values = [
    data.status,
    data.domain_status,
    data.dkim?.status,
    data.cname?.status,
  ].map((value) => value?.toLowerCase() ?? '');
  return values.some((value) => value.includes('fail')) ? 'failed' : 'pending';
}

export function toSendingDomainState(
  data: ZeptomailDomainData
): SendingDomainState {
  const records: ZeptomailDnsRecord[] = [];
  if (data.dkim?.host && data.dkim.public_key) {
    records.push({
      type: 'TXT',
      host: data.dkim.host,
      value: data.dkim.public_key,
    });
  }
  if (data.cname?.host && data.cname.cname_record) {
    records.push({
      type: 'CNAME',
      host: data.cname.host,
      value: data.cname.cname_record,
    });
  }
  const verified =
    data.dkim?.status?.toLowerCase() === 'verified' &&
    data.cname?.status?.toLowerCase() === 'verified';
  const status = toVerificationStatus(data, verified);
  return {
    domainKey: data.domain_key,
    domain: data.domain_name,
    status,
    verified,
    records,
    associatedMailagentKeys: extractAssociatedMailagentKeys(data),
  };
}

export function isAssociatedWithConfiguredMailagent(
  state: SendingDomainState
): boolean {
  const mailagentKey = getZeptoMailAgentKey();
  return Boolean(
    mailagentKey && state.associatedMailagentKeys.includes(mailagentKey)
  );
}

export function mergeSendingDomainState(
  base: SendingDomainState,
  override: SendingDomainState
): SendingDomainState {
  const recordKey = (record: ZeptomailDnsRecord) => record.type;
  const records = new Map<string, ZeptomailDnsRecord>();
  for (const record of base.records) records.set(recordKey(record), record);
  for (const record of override.records) records.set(recordKey(record), record);

  return {
    ...base,
    ...override,
    associatedMailagentKeys: override.associatedMailagentKeys.length
      ? override.associatedMailagentKeys
      : base.associatedMailagentKeys,
    records: [...records.values()],
  };
}
