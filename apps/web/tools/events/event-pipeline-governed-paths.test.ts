import { describe, expect, it } from 'vitest';
import { eventPipelineGovernedPaths } from './event-pipeline-governed-paths';

describe('eventPipelineGovernedPaths', () => {
  it('loads the frozen seed inventory and current source inventory safely', () => {
    const governed = eventPipelineGovernedPaths.collect();
    expect(governed.fixtureRecordCount).toBe(154);
    expect(governed.paths).toContain(
      'apps/web/tools/events/event-pipeline-governed-paths.ts'
    );
    expect(governed.missingProductionRoots).toEqual([]);
  });
});
