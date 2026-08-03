import { expect, it } from 'vitest';
import { eventPipelineBoundaryManifest } from './event-pipeline-boundary-manifest';

it('does not treat onboarding actions as an event-pipeline authority root', () => {
  const onboardingActions = 'apps/web/src/app/(platform)/onboarding/actions.ts';

  expect(eventPipelineBoundaryManifest.authority.adminImporters).not.toContain(
    onboardingActions
  );
  expect(eventPipelineBoundaryManifest.authority.serverImporters).not.toContain(
    onboardingActions
  );
});
