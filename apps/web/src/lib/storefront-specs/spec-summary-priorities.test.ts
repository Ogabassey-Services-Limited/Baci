import { describe, expect, it } from 'vitest';
import { SUMMARY_SPEC_PRIORITIES } from './spec-summary-priorities';

describe('summary spec priorities', () => {
  it('prioritizes camera internal storage as a summary fact', () => {
    const storagePriority = SUMMARY_SPEC_PRIORITIES.find(
      (entry) => entry.label === 'Storage'
    );

    expect(storagePriority?.candidates).toContainEqual([
      'Storage',
      'Internal Storage',
    ]);
  });
});
