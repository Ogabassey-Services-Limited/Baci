import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findImportedSuccessorSuites } from '@/lib/find-imported-successor-suites.test-utils';

const directory = join(process.cwd(), 'src/app/api/events');
const successors = [
  'route.validation.test.ts',
  'route.persistence.test.ts',
  'route.event-data.test.ts',
  'route.fanout.test.ts',
  'route.timestamp.test.ts',
] as const;

describe('events route split manifest', () => {
  it('keeps runtime and successor suites within the modularity limit', () => {
    for (const file of ['route.ts', ...successors]) {
      const source = readFileSync(`${directory}/${file}`, 'utf8');
      const lineCount =
        source.split(/\r?\n/).length - Number(source.endsWith('\n'));
      expect(lineCount, file).toBeLessThanOrEqual(300);
    }
  });

  it('does not import or register successor suites', () => {
    const source = readFileSync(join(directory, 'route.test.ts'), 'utf8');
    expect(findImportedSuccessorSuites(source, successors)).toEqual([]);
  });
});
