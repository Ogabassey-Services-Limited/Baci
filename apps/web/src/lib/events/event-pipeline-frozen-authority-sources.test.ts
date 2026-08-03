import { expect, it } from 'vitest';
import { frozenEventPipelineAuthoritySources } from './event-pipeline-frozen-authority-sources';

it('freezes only the reviewed onboarding authority source', () => {
  const onboardingActions = 'apps/web/src/app/(platform)/onboarding/actions.ts';

  expect(frozenEventPipelineAuthoritySources).toEqual({
    [onboardingActions]:
      'ad902de74546a2ab71e1847b25076a3a3d6df711d0d5ea6229796bfe9bbb94d5',
  });
  expect(Object.values(frozenEventPipelineAuthoritySources)).toEqual([
    expect.stringMatching(/^[a-f0-9]{64}$/),
  ]);
});
