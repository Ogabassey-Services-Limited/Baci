import { describe, expect, it } from 'vitest';
import { deterministicEventUuid } from './deterministic-event-uuid';

const UUID_V5_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('deterministicEventUuid', () => {
  it('produces a valid RFC 4122 v5 uuid', () => {
    expect(deterministicEventUuid('wallet_funding_transfer_credited:tx-1')).toMatch(
      UUID_V5_PATTERN
    );
  });

  it('is stable for the same name so concurrent emitters dedupe', () => {
    const first = deterministicEventUuid('wallet_funding_transfer_credited:tx-1');
    const second = deterministicEventUuid(
      'wallet_funding_transfer_credited:tx-1'
    );

    expect(first).toBe(second);
  });

  it('differs across names so distinct events are never merged', () => {
    expect(
      deterministicEventUuid('wallet_funding_transfer_credited:tx-1')
    ).not.toBe(deterministicEventUuid('wallet_funding_transfer_credited:tx-2'));
  });
});
