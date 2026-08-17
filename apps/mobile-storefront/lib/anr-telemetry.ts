import { requireOptionalNativeModule } from 'expo-modules-core';

export type PreviousProcessExit = {
  importance?: number;
  pid?: number;
  processStateSummary?: string | null;
  reason?: string;
  reasonCode?: number;
  timestamp: number;
  traceAvailable?: boolean;
};

type NativeAnrTelemetry = {
  acknowledgePreviousExit(timestamp: number): void;
  beginSurfaceTrace(surface: string, instanceId: string): void;
  endSurfaceTrace(surface: string, instanceId: string): void;
  getPreviousExit(): Promise<unknown>;
  setActiveSurface(surface: string, instanceId: string, focused: boolean): void;
};

function getNativeModule(): NativeAnrTelemetry | null {
  return requireOptionalNativeModule<NativeAnrTelemetry>('BaciAnrTelemetry');
}

export function setNativeActiveSurface(
  surface: string,
  instanceId: string,
  focused: boolean
): void {
  try {
    getNativeModule()?.setActiveSurface(surface, instanceId, focused);
  } catch {
    // Telemetry must never affect rendering or navigation.
  }
}

export function beginNativeSurfaceTrace(
  surface: string,
  instanceId: string
): void {
  try {
    getNativeModule()?.beginSurfaceTrace(surface, instanceId);
  } catch {
    // Trace markers are best effort.
  }
}

export function endNativeSurfaceTrace(
  surface: string,
  instanceId: string
): void {
  try {
    getNativeModule()?.endSurfaceTrace(surface, instanceId);
  } catch {
    // Trace markers are best effort.
  }
}

export async function getPreviousProcessExit(): Promise<PreviousProcessExit | null> {
  try {
    const exit = await getNativeModule()?.getPreviousExit();
    if (!exit || typeof exit !== 'object') return null;

    const candidate = exit as Record<string, unknown>;
    const timestamp = candidate.timestamp;
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
      return null;
    }

    return {
      importance:
        typeof candidate.importance === 'number'
          ? candidate.importance
          : undefined,
      pid: typeof candidate.pid === 'number' ? candidate.pid : undefined,
      processStateSummary:
        typeof candidate.processStateSummary === 'string'
          ? candidate.processStateSummary
          : null,
      reason:
        typeof candidate.reason === 'string' ? candidate.reason : undefined,
      reasonCode:
        typeof candidate.reasonCode === 'number'
          ? candidate.reasonCode
          : undefined,
      timestamp,
      traceAvailable: candidate.traceAvailable === true,
    };
  } catch {
    return null;
  }
}

export function acknowledgePreviousProcessExit(timestamp: number): void {
  try {
    getNativeModule()?.acknowledgePreviousExit(timestamp);
  } catch {
    // A duplicate diagnostic is safer than affecting app startup.
  }
}
