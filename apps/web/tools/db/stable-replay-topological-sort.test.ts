import { describe, expect, it } from 'vitest';
import { stableReplayTopologicalSort } from './stable-replay-topological-sort';

const source = (name: string) => ({
  receiptId: `test:${name}`,
  repositoryPath: `supabase/migrations/${name}.sql`,
  sha256: name.padEnd(64, '0').slice(0, 64),
});

describe('stableReplayTopologicalSort', () => {
  it('uses sort key then block id while preserving each block source order', () => {
    const blocks = new Map([
      [
        'later',
        { sortKey: '002', sources: [source('later-a'), source('later-b')] },
      ],
      ['same-b', { sortKey: '001', sources: [source('same-b')] }],
      ['same-a', { sortKey: '001', sources: [source('same-a')] }],
    ]);
    const edges = new Map([['same-a', new Set(['later'])]]);

    expect(
      stableReplayTopologicalSort(blocks, edges).map(
        ({ repositoryPath }) => repositoryPath
      )
    ).toEqual([
      'supabase/migrations/same-a.sql',
      'supabase/migrations/same-b.sql',
      'supabase/migrations/later-a.sql',
      'supabase/migrations/later-b.sql',
    ]);
  });

  it('breaks tied sort keys with deterministic code-unit block-id order', () => {
    const blocks = new Map([
      ['same-a', { sortKey: '001', sources: [source('same-a')] }],
      ['same-A', { sortKey: '001', sources: [source('same-A')] }],
    ]);

    expect(
      stableReplayTopologicalSort(blocks, new Map()).map(
        ({ repositoryPath }) => repositoryPath
      )
    ).toEqual([
      'supabase/migrations/same-A.sql',
      'supabase/migrations/same-a.sql',
    ]);
  });

  it.each([
    ['unknown origin', new Map([['missing', new Set(['known'])]])],
    ['unknown destination', new Map([['known', new Set(['missing'])]])],
  ])('rejects an %s node', (_label, edges) => {
    const blocks = new Map([
      ['known', { sortKey: '001', sources: [source('known')] }],
    ]);

    expect(() => stableReplayTopologicalSort(blocks, edges)).toThrow(
      'unknown replay source block'
    );
  });

  it('rejects a relation cycle', () => {
    const blocks = new Map([
      ['a', { sortKey: '001', sources: [source('a')] }],
      ['b', { sortKey: '002', sources: [source('b')] }],
    ]);
    const edges = new Map([
      ['a', new Set(['b'])],
      ['b', new Set(['a'])],
    ]);

    expect(() => stableReplayTopologicalSort(blocks, edges)).toThrow(
      'production-effect replay relation cycle'
    );
  });
});
