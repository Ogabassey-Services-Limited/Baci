import { describe, expect, it } from 'vitest';
import { parseSupabaseMigrationList } from './parse-supabase-migration-list';

const output = `
   Local          | Remote         | Time (UTC)
  ----------------|----------------|---------------------
   20260701000000 | 20260701000000 | 2026-07-01 00:00:00
                  | 20260701000001 | 2026-07-01 00:00:01
   20260701000002 |                | 2026-07-01 00:00:02
   20260712150075 | 20260712150075 | 20260712150075
`;

describe('parseSupabaseMigrationList', () => {
  it('parses the strict linked migration table without claiming order', () => {
    expect(parseSupabaseMigrationList(output)).toEqual([
      {
        localVersion: '20260701000000',
        remoteVersion: '20260701000000',
        timeUtc: '2026-07-01 00:00:00',
      },
      {
        localVersion: null,
        remoteVersion: '20260701000001',
        timeUtc: '2026-07-01 00:00:01',
      },
      {
        localVersion: '20260701000002',
        remoteVersion: null,
        timeUtc: '2026-07-01 00:00:02',
      },
      {
        localVersion: '20260712150075',
        remoteVersion: '20260712150075',
        timeUtc: '20260712150075',
      },
    ]);
  });

  it.each([
    output.replace('20260701000000', 'not-a-version'),
    output.replace('----------------|', 'broken|'),
    output.replace(
      '20260712150075 | 20260712150075 | 20260712150075',
      '20260712150075 | 20260712150075 | 20260712150076'
    ),
    `${output}\nunexpected raw diagnostic\n`,
    'Local | Remote | Time (UTC)\n',
  ])('fails malformed output without echoing it', (candidate) => {
    expect(() => parseSupabaseMigrationList(candidate)).toThrow(
      /^Invalid Supabase migration list output$/
    );
  });
});
