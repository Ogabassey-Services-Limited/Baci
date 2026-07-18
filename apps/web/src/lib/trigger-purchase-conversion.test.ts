import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findImportedSuccessorSuites } from './find-imported-successor-suites.test-utils';

const directory = join(process.cwd(), 'src/lib');
const successors = [
  'trigger-purchase-conversion.delivery.test.ts',
  'trigger-purchase-conversion.currency.test.ts',
  'trigger-purchase-conversion.validation.test.ts',
] as const;

describe('triggerPurchaseConversion split manifest', () => {
  it('keeps runtime and successor suites within the modularity limit', () => {
    for (const file of ['trigger-purchase-conversion.ts', ...successors]) {
      const source = readFileSync(join(directory, file), 'utf8');
      const lineCount =
        source.split(/\r?\n/).length - Number(source.endsWith('\n'));
      expect(lineCount, file).toBeLessThanOrEqual(300);
    }
  });

  it('does not import or register successor suites', () => {
    const source = readFileSync(
      join(directory, 'trigger-purchase-conversion.test.ts'),
      'utf8'
    );
    expect(findImportedSuccessorSuites(source, successors)).toEqual([]);
  });
});
