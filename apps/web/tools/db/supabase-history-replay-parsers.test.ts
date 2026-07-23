import { describe, expect, it } from 'vitest';
import {
  migration,
  parseFrozenSources,
  parseProductionMappings,
} from './supabase-history-replay-parsers';

const SHA = 'a'.repeat(64);

describe('supabase-history-replay-parsers', () => {
  it('prefixes migration filenames with the repository migrations path', () => {
    expect(migration('20260101000000_example.sql')).toBe(
      'supabase/migrations/20260101000000_example.sql'
    );
  });

  it('parses frozen source rows into path-bound sha entries', () => {
    expect(
      parseFrozenSources(
        `\n${SHA} 20260101000000_first.sql\n${SHA} 20260102000000_second.sql\n`
      )
    ).toEqual([
      {
        repositoryPath: 'supabase/migrations/20260101000000_first.sql',
        sha256: SHA,
      },
      {
        repositoryPath: 'supabase/migrations/20260102000000_second.sql',
        sha256: SHA,
      },
    ]);
  });

  it('throws on a frozen source row without a separator', () => {
    expect(() => parseFrozenSources('not-a-valid-row')).toThrow(
      'Invalid frozen replay source row'
    );
  });

  it('throws on a frozen source row with a trailing separator', () => {
    expect(() => parseFrozenSources(`${SHA} `)).toThrow(
      'Invalid frozen replay source row'
    );
  });

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
