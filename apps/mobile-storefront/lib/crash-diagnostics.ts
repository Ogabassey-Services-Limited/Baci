import { createLogger } from './logger';

const log = createLogger('CrashDiagnostics');
export const MAX_BREADCRUMBS = 30;

export interface CrashBreadcrumb {
  details?: Record<string, unknown>;
  name: string;
  timestamp: string;
}

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;

interface ErrorUtilsLike {
  getGlobalHandler?: () => GlobalErrorHandler;
  setGlobalHandler?: (handler: GlobalErrorHandler) => void;
}

type GlobalWithErrorUtils = typeof globalThis & {
  ErrorUtils?: ErrorUtilsLike;
};

let breadcrumbs: CrashBreadcrumb[] = [];
let installed = false;
let previousGlobalHandler: GlobalErrorHandler | undefined;

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
    name: 'NonError',
  };
}

export function recordCrashBreadcrumb(
  name: string,
  details?: Record<string, unknown>
) {
  const breadcrumb: CrashBreadcrumb = {
    details,
    name,
    timestamp: new Date().toISOString(),
  };
  breadcrumbs = [...breadcrumbs, breadcrumb].slice(-MAX_BREADCRUMBS);

  if (process.env.NODE_ENV !== 'test') {
    log.info('breadcrumb', breadcrumb);
  }
}

export function installCrashDiagnostics(context = 'global') {
  if (installed) return;
  installed = true;

  const errorUtils = (globalThis as GlobalWithErrorUtils).ErrorUtils;
  if (!errorUtils?.setGlobalHandler) {
    recordCrashBreadcrumb('crash_diagnostics:error_utils_unavailable', {
      context,
    });
    return;
  }

  previousGlobalHandler = errorUtils.getGlobalHandler?.();
  errorUtils.setGlobalHandler((error, isFatal) => {
    log.error('global JS error', {
      breadcrumbs,
      context,
      error: serializeError(error),
      isFatal,
    });
    previousGlobalHandler?.(error, isFatal);
  });

  recordCrashBreadcrumb('crash_diagnostics:installed', { context });
}

export function getCrashBreadcrumbsForTest() {
  return breadcrumbs;
}

export function resetCrashDiagnosticsForTest() {
  if (process.env.NODE_ENV !== 'test') return;
  breadcrumbs = [];
  installed = false;
  previousGlobalHandler = undefined;
}
