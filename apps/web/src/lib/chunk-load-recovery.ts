import {
  type ChunkFailureDetails,
  detectChunkFailureFromResourceTarget,
  detectChunkFailureFromValue,
} from '@/lib/chunk-load-recovery/chunk-failure-detection';
import { getPageDeploymentId } from '@/lib/chunk-load-recovery/page-deployment-id';
import {
  evaluateRecoveryGuard,
  type RecoveryGuardDecision,
  type RecoveryGuardStorage,
} from '@/lib/chunk-load-recovery/recovery-guard';
import {
  type ChunkRecoveryTriggerSource,
  sendChunkRecoveryTelemetry,
} from '@/lib/chunk-load-recovery/recovery-telemetry';

let chunkLoadRecoveryInitialized = false;
let browserRuntime: ChunkLoadRecoveryRuntime | undefined;

export interface ChunkLoadRecoveryRuntime {
  getDeploymentId: () => string;
  getPathname: () => string;
  getSessionStorage: () => RecoveryGuardStorage | undefined;
  reload: () => void;
  getHost?: () => string;
  getWindowName?: () => string;
  setWindowName?: (value: string) => void;
  isOffline?: () => boolean;
  sendTelemetry?: typeof sendChunkRecoveryTelemetry;
}

function resolveGuardDecision(
  runtime: ChunkLoadRecoveryRuntime,
  commit: boolean
): RecoveryGuardDecision | 'skipped-offline' {
  if (runtime.isOffline?.()) {
    // Reloading a fully offline tab replaces the app with the browser's
    // network-error page; the error boundary UI is strictly better.
    return 'skipped-offline';
  }

  return evaluateRecoveryGuard(
    runtime,
    runtime.getDeploymentId(),
    runtime.getPathname(),
    commit
  );
}

function runRecovery(
  runtime: ChunkLoadRecoveryRuntime,
  details: ChunkFailureDetails,
  triggerSource: ChunkRecoveryTriggerSource
): boolean {
  const decision = resolveGuardDecision(runtime, true);

  try {
    runtime.sendTelemetry?.({
      action: decision === 'reload' ? 'reload' : decision,
      failedAssetDeploymentId: details.failedAssetDeploymentId,
      failedAssetUrl: details.failedAssetUrl,
      pageDeploymentId: runtime.getDeploymentId(),
      pathname: runtime.getPathname(),
      triggerSource,
    });
  } catch {
    // Telemetry is best-effort; it must never block the recovery reload.
  }

  if (decision !== 'reload') {
    return false;
  }

  runtime.reload();
  return true;
}

export function createChunkLoadRecoveryHandlers(
  runtime: ChunkLoadRecoveryRuntime
) {
  return {
    handleWindowError(
      event: Pick<ErrorEvent, 'error' | 'message'> & { target?: unknown }
    ): void {
      const details =
        detectChunkFailureFromValue(event.error) ??
        detectChunkFailureFromValue(event.message);

      if (details) {
        runRecovery(runtime, details, 'window-error');
        return;
      }

      // Resource load failures dispatch plain events with no error/message;
      // the failing <script>/<link> element is the only available signal.
      const resourceDetails = detectChunkFailureFromResourceTarget(
        event.target
      );
      if (resourceDetails) {
        runRecovery(runtime, resourceDetails, 'resource-error');
      }
    },

    handleUnhandledRejection(
      event: Pick<PromiseRejectionEvent, 'reason'>
    ): void {
      const details = detectChunkFailureFromValue(event.reason);
      if (details) {
        runRecovery(runtime, details, 'unhandled-rejection');
      }
    },
  };
}

function getBrowserRuntime(): ChunkLoadRecoveryRuntime | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  if (!browserRuntime) {
    const initialDeploymentId = getPageDeploymentId();
    browserRuntime = {
      getDeploymentId: () => initialDeploymentId,
      getHost: () => window.location.host,
      getPathname: () => window.location.pathname,
      getSessionStorage: () => window.sessionStorage,
      getWindowName: () => window.name,
      isOffline: () => window.navigator.onLine === false,
      reload: () => window.location.reload(),
      sendTelemetry: sendChunkRecoveryTelemetry,
      setWindowName: (value) => {
        window.name = value;
      },
    };
  }

  return browserRuntime;
}

/**
 * Entry point for React error boundaries. In production, render errors caught
 * by route `error.tsx` boundaries never dispatch `window` error events, so
 * chunk failures during client navigation are invisible to the listeners
 * below — boundaries must hand the caught error to recovery themselves.
 * Returns true when a recovery reload has been scheduled.
 */
export function attemptChunkLoadRecoveryFromBoundary(error: unknown): boolean {
  const runtime = getBrowserRuntime();
  if (!runtime) {
    return false;
  }

  const details = detectChunkFailureFromValue(error);
  if (!details) {
    return false;
  }

  return runRecovery(runtime, details, 'error-boundary');
}

/**
 * Pure check for render time: would recovery reload for this error right now?
 * Does not consume the once-per-deployment/path guard, so boundaries can pick
 * their UI before committing the reload in an effect.
 */
export function isChunkLoadRecoveryPending(error: unknown): boolean {
  const runtime = getBrowserRuntime();
  if (!runtime || !detectChunkFailureFromValue(error)) {
    return false;
  }

  return resolveGuardDecision(runtime, false) === 'reload';
}

export function initializeChunkLoadRecovery(): void {
  if (typeof window === 'undefined' || chunkLoadRecoveryInitialized) {
    return;
  }

  chunkLoadRecoveryInitialized = true;
  const runtime = getBrowserRuntime();
  if (!runtime) {
    return;
  }

  const handlers = createChunkLoadRecoveryHandlers(runtime);

  window.addEventListener('error', handlers.handleWindowError, {
    capture: true,
  });
  window.addEventListener(
    'unhandledrejection',
    handlers.handleUnhandledRejection,
    { capture: true }
  );
}
