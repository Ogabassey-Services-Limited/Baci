import { describe, expect, it, vi } from 'vitest';
import {
  isUniqueDomainReservationError,
  recordsToColumns,
  rowToDomain,
  stateToColumns,
  writeDomainViaRpc,
} from './merchant-email-domain-shared';

const BASE_ROW = {
  domain: 'ogabassey.com',
  sender_local_part: 'noreply',
  status: 'verified' as const,
  enabled: true,
  dkim_host: 'sel._domainkey.ogabassey.com',
  dkim_value: 'k=rsa; p=AAA',
  bounce_host: 'bounce.ogabassey.com',
  bounce_value: 'cluster.zeptomail.com',
};

describe('rowToDomain', () => {
  it('maps a row with DKIM + CNAME into both DNS records', () => {
    const result = rowToDomain(BASE_ROW);
    expect(result).toMatchObject({
      domain: 'ogabassey.com',
      senderLocalPart: 'noreply',
      status: 'verified',
      enabled: true,
    });
    expect(result.records).toEqual([
      { type: 'TXT', host: BASE_ROW.dkim_host, value: BASE_ROW.dkim_value },
      {
        type: 'CNAME',
        host: BASE_ROW.bounce_host,
        value: BASE_ROW.bounce_value,
      },
    ]);
  });

  it('omits records when DNS columns are null', () => {
    const result = rowToDomain({
      ...BASE_ROW,
      dkim_host: null,
      dkim_value: null,
      bounce_host: null,
      bounce_value: null,
    });
    expect(result.records).toEqual([]);
  });
});

describe('recordsToColumns', () => {
  it('splits TXT into DKIM and CNAME into bounce columns', () => {
    expect(
      recordsToColumns([
        { type: 'TXT', host: 'd', value: 'dv' },
        { type: 'CNAME', host: 'b', value: 'bv' },
      ])
    ).toEqual({
      dkim_host: 'd',
      dkim_value: 'dv',
      bounce_host: 'b',
      bounce_value: 'bv',
    });
  });

  it('nulls missing records', () => {
    expect(recordsToColumns([])).toEqual({
      dkim_host: null,
      dkim_value: null,
      bounce_host: null,
      bounce_value: null,
    });
  });
});

describe('stateToColumns', () => {
  it('marks verified state with a timestamp', () => {
    const cols = stateToColumns({
      domainKey: 'dk1',
      domain: 'ogabassey.com',
      status: 'verified',
      verified: true,
      records: [{ type: 'TXT', host: 'd', value: 'dv' }],
      associatedMailagentKeys: ['mail_agent_1'],
    });
    expect(cols.status).toBe('verified');
    expect(cols.zeptomail_domain_id).toBe('dk1');
    expect(typeof cols.verified_at).toBe('string');
    expect(cols.dkim_host).toBe('d');
  });

  it('marks unverified state pending with no timestamp', () => {
    const cols = stateToColumns({
      domainKey: 'dk1',
      domain: 'ogabassey.com',
      status: 'pending',
      verified: false,
      records: [],
      associatedMailagentKeys: [],
    });
    expect(cols.status).toBe('pending');
    expect(cols.verified_at).toBeNull();
  });
});

describe('isUniqueDomainReservationError', () => {
  it('detects the unique-violation code', () => {
    expect(isUniqueDomainReservationError({ code: '23505' })).toBe(true);
  });

  it('detects the constraint name in the message', () => {
    expect(
      isUniqueDomainReservationError({
        message:
          'duplicate key value violates merchant_email_domains_domain_key',
      })
    ).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isUniqueDomainReservationError({ code: '500' })).toBe(false);
    expect(isUniqueDomainReservationError(null)).toBe(false);
    expect(isUniqueDomainReservationError('nope')).toBe(false);
  });
});

describe('writeDomainViaRpc', () => {
  it('returns the row on success', async () => {
    const maybeSingle = vi.fn(() =>
      Promise.resolve({ data: BASE_ROW, error: null })
    );
    const supabase = { rpc: vi.fn(() => ({ maybeSingle })) } as never;

    const result = await writeDomainViaRpc(
      supabase,
      'set_merchant_email_domain_enabled',
      { p_enabled: true },
      'Failed'
    );
    expect(result).toEqual(BASE_ROW);
  });

  it('throws with the prefix on error', async () => {
    const maybeSingle = vi.fn(() =>
      Promise.resolve({ data: null, error: { message: 'boom' } })
    );
    const supabase = { rpc: vi.fn(() => ({ maybeSingle })) } as never;

    await expect(
      writeDomainViaRpc(
        supabase,
        'set_merchant_email_domain_enabled',
        {},
        'Failed to update email domain'
      )
    ).rejects.toThrow('Failed to update email domain: boom');
  });
});
