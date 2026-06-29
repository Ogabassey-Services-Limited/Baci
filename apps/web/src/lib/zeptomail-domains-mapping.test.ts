import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { getZeptoMailAgentKey } = vi.hoisted(() => ({
  getZeptoMailAgentKey: vi.fn<() => string | undefined>(),
}));
vi.mock('@/env', () => ({ getZeptoMailAgentKey }));

import {
  domainRows,
  firstDomain,
  isAssociatedWithConfiguredMailagent,
  mergeSendingDomainState,
  type SendingDomainState,
  toSendingDomainState,
  type ZeptomailDomainData,
} from './zeptomail-domains-mapping';

const VERIFIED_DOMAIN: ZeptomailDomainData = {
  domain_name: 'ogabassey.com',
  domain_key: 'dk1',
  dkim: {
    host: 'sel._domainkey.ogabassey.com',
    public_key: 'p=AAA',
    status: 'verified',
  },
  cname: {
    host: 'bounce.ogabassey.com',
    cname_record: 'cluster.zeptomail.com',
    status: 'verified',
  },
  mailagent_keys: ['mail_agent_1'],
};

describe('domainRows / firstDomain', () => {
  it('wraps a single object and passes arrays through', () => {
    expect(domainRows({ data: VERIFIED_DOMAIN })).toHaveLength(1);
    expect(
      domainRows({ data: [VERIFIED_DOMAIN, VERIFIED_DOMAIN] })
    ).toHaveLength(2);
    expect(domainRows({})).toEqual([]);
    expect(domainRows(null)).toEqual([]);
  });

  it('firstDomain throws when no domain data is present', () => {
    expect(() => firstDomain({ data: [] })).toThrow('no domain data');
  });
});

describe('toSendingDomainState', () => {
  it('maps DKIM + CNAME into records and marks verified', () => {
    const state = toSendingDomainState(VERIFIED_DOMAIN);
    expect(state).toMatchObject({
      domainKey: 'dk1',
      domain: 'ogabassey.com',
      status: 'verified',
      verified: true,
      associatedMailagentKeys: ['mail_agent_1'],
    });
    expect(state.records).toEqual([
      { type: 'TXT', host: 'sel._domainkey.ogabassey.com', value: 'p=AAA' },
      {
        type: 'CNAME',
        host: 'bounce.ogabassey.com',
        value: 'cluster.zeptomail.com',
      },
    ]);
  });

  it('reports pending when records are present but unverified', () => {
    const state = toSendingDomainState({
      ...VERIFIED_DOMAIN,
      dkim: { ...VERIFIED_DOMAIN.dkim, status: 'pending' },
    });
    expect(state.verified).toBe(false);
    expect(state.status).toBe('pending');
  });

  it('reports failed when a record status contains "fail"', () => {
    const state = toSendingDomainState({
      ...VERIFIED_DOMAIN,
      dkim: { ...VERIFIED_DOMAIN.dkim, status: 'failed' },
    });
    expect(state.status).toBe('failed');
  });

  it('collects mailagent keys from both shapes', () => {
    const state = toSendingDomainState({
      ...VERIFIED_DOMAIN,
      mailagent_keys: ['a'],
      associated_mailagents: ['b', { mailagent_key: 'c' }],
    });
    expect(state.associatedMailagentKeys.sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('isAssociatedWithConfiguredMailagent', () => {
  const base: SendingDomainState = {
    domainKey: 'dk1',
    domain: 'ogabassey.com',
    status: 'verified',
    verified: true,
    records: [],
    associatedMailagentKeys: ['mail_agent_1'],
  };

  beforeEach(() => vi.clearAllMocks());

  it('is true when the configured key is associated', () => {
    getZeptoMailAgentKey.mockReturnValue('mail_agent_1');
    expect(isAssociatedWithConfiguredMailagent(base)).toBe(true);
  });

  it('is false when the key is missing or not associated', () => {
    getZeptoMailAgentKey.mockReturnValue('other');
    expect(isAssociatedWithConfiguredMailagent(base)).toBe(false);
    getZeptoMailAgentKey.mockReturnValue(undefined);
    expect(isAssociatedWithConfiguredMailagent(base)).toBe(false);
  });
});

describe('mergeSendingDomainState', () => {
  it('overrides scalars, unions records by type, preserves base keys when override empty', () => {
    const base: SendingDomainState = {
      domainKey: 'dk1',
      domain: 'ogabassey.com',
      status: 'pending',
      verified: false,
      records: [{ type: 'TXT', host: 'h', value: 'v' }],
      associatedMailagentKeys: ['mail_agent_1'],
    };
    const override: SendingDomainState = {
      domainKey: 'dk1',
      domain: 'ogabassey.com',
      status: 'verified',
      verified: true,
      records: [{ type: 'CNAME', host: 'c', value: 'cv' }],
      associatedMailagentKeys: [],
    };

    const merged = mergeSendingDomainState(base, override);
    expect(merged.status).toBe('verified');
    expect(merged.associatedMailagentKeys).toEqual(['mail_agent_1']);
    expect(merged.records).toEqual([
      { type: 'TXT', host: 'h', value: 'v' },
      { type: 'CNAME', host: 'c', value: 'cv' },
    ]);
  });
});
