import type { RecoveryGuardDecision } from '@/lib/chunk-load-recovery/recovery-guard';
import { normalizePostHogProxyPath } from '@/lib/posthog/config';
import { readPostHogPersistedIdentity } from '@/lib/posthog/persisted-identity';

export type ChunkRecoveryAction = RecoveryGuardDecision | 'skipped-offline';

export type ChunkRecoveryTriggerSource =
  | 'window-error'
  | 'unhandled-rejection'
  | 'resource-error'
  | 'error-boundary';

export interface ChunkRecoveryTelemetry {
  action: ChunkRecoveryAction;
  triggerSource: ChunkRecoveryTriggerSource;
  pathname: string;
  pageDeploymentId: string;
  failedAssetUrl: string | null;
  failedAssetDeploymentId: string | null;
}

function generateAnonymousDistinctId(): string {
  try {
    return `chunk-recovery-${window.crypto.randomUUID()}`;
  } catch {
    return `chunk-recovery-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Reports a recovery decision to PostHog without going through posthog-js.
 * The lazily imported PostHog chunk may itself be unloadable during a chunk
 * outage, and a scheduled reload must not lose the event, so this posts a
 * single capture payload straight to the ingest proxy via sendBeacon.
 */
export function sendChunkRecoveryTelemetry(
  telemetry: ChunkRecoveryTelemetry
): void {
  try {
    const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    if (!projectToken || typeof window === 'undefined') {
      return;
    }

    const identity = readPostHogPersistedIdentity(projectToken);
    // The asset-fingerprint tier of getPageDeploymentId prefixes with 'dpl:'
    // while failed-asset ids come from the raw ?dpl= query — strip the prefix
    // so same-deployment failures compare as a match.
    const normalizedPageDeploymentId = telemetry.pageDeploymentId.replace(
      /^dpl:/,
      ''
    );
    const payload = JSON.stringify({
      api_key: projectToken,
      event: 'chunk_load_recovery',
      timestamp: new Date().toISOString(),
      properties: {
        $current_url: window.location.href,
        $process_person_profile: false,
        $session_id: identity.sessionId,
        app_surface: 'web',
        deployment_id_match:
          telemetry.failedAssetDeploymentId === null
            ? null
            : telemetry.failedAssetDeploymentId === normalizedPageDeploymentId,
        failed_asset_deployment_id: telemetry.failedAssetDeploymentId,
        failed_asset_url: telemetry.failedAssetUrl,
        page_deployment_id: telemetry.pageDeploymentId,
        pathname: telemetry.pathname,
        distinct_id: identity.distinctId ?? generateAnonymousDistinctId(),
        recovery_action: telemetry.action,
        runtime: 'browser',
        trigger_source: telemetry.triggerSource,
      },
    });

    const endpoint = `${normalizePostHogProxyPath(
      process.env.NEXT_PUBLIC_POSTHOG_PROXY_PATH
    )}/e/`;

    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(
        endpoint,
        new Blob([payload], { type: 'text/plain' })
      );
      return;
    }

    fetch(endpoint, {
      body: payload,
      headers: { 'Content-Type': 'text/plain' },
      keepalive: true,
      method: 'POST',
    }).catch(() => {
      // A rejected transport must not surface as an unhandled rejection.
    });
  } catch {
    // Telemetry must never interfere with the recovery reload itself.
  }
}
