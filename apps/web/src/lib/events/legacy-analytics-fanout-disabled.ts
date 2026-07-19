import { eventPipelineAuthorityCutover } from './event-pipeline-authority-cutover';

export function isLegacyAnalyticsFanoutDisabled(): boolean {
  const authorityExpiry = Date.parse(
    eventPipelineAuthorityCutover.temporaryAuthorityExpiresAt
  );
  return (
    eventPipelineAuthorityCutover.queueOnlyDeliveryActivated ||
    !Number.isFinite(authorityExpiry) ||
    Date.now() >= authorityExpiry
  );
}
