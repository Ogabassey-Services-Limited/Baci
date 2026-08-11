import { describe, expect, it } from 'vitest';
import {
  eventPipelineAdminImporters,
  eventPipelineLegacySdkImporters,
} from './event-pipeline-authority-paths';

describe('event-pipeline authority paths', () => {
  it('keeps the privileged importer allowlist explicit', () => {
    expect(eventPipelineAdminImporters).toContain(
      'apps/web/src/app/api/platform/events/platform-event-forwarding.ts'
    );
    expect(eventPipelineAdminImporters).toContain(
      'apps/web/src/lib/expo-push.ts'
    );
  });

  it('keeps legacy SDK importers separate from privileged importers', () => {
    expect(eventPipelineLegacySdkImporters).toContain(
      'apps/web/src/lib/events/event-pipeline-test-client.ts'
    );
    expect(eventPipelineLegacySdkImporters).not.toContain(
      'apps/web/src/lib/expo-push.ts'
    );
  });
});
