import { describe, expect, it } from 'vitest';
import { parseProductionMappings } from './supabase-history-replay-production-mappings';

const SHA = 'a'.repeat(64);

describe('parseProductionMappings', () => {
  it('parses production mapping rows against the linked-name registry', () => {
    const row = [
      '20260623190041',
      '20260623190000_enable_realtime_negotiation_requests.sql',
      SHA,
      'canonical',
    ].join('\t');

    expect(parseProductionMappings(row)).toEqual([
      {
        appliedName: 'enable_realtime_negotiation_requests',
        appliedVersion: '20260623190000',
        linkedName: 'enable_realtime_negotiation_requests',
        productionVersion: '20260623190041',
        repositoryPath:
          'supabase/migrations/20260623190000_enable_realtime_negotiation_requests.sql',
        rule: 'canonical',
        sha256: SHA,
      },
    ]);
  });

  it('throws on a production mapping for an unregistered version', () => {
    const row = [
      '19990101000000',
      '19990101000000_unknown.sql',
      SHA,
      'canonical',
    ].join('\t');

    expect(() => parseProductionMappings(row)).toThrow(
      'Invalid production replay mapping row'
    );
  });

  it('throws on a production mapping with an unknown rule', () => {
    const row = [
      '20260623190041',
      '20260623190000_enable_realtime_negotiation_requests.sql',
      SHA,
      'not-a-rule',
    ].join('\t');

    expect(() => parseProductionMappings(row)).toThrow(
      'Invalid production replay mapping row'
    );
  });

  it('rejects inherited object property names as mapping rules', () => {
    const row = [
      '20260623190041',
      '20260623190000_enable_realtime_negotiation_requests.sql',
      SHA,
      'toString',
    ].join('\t');

    expect(() => parseProductionMappings(row)).toThrow(
      'Invalid production replay mapping row'
    );
  });
});
