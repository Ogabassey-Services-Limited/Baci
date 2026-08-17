import * as Sentry from '@sentry/react-native';
import { trackEvent } from '@/services/analytics';
import {
  beginNativeSurfaceTrace,
  endNativeSurfaceTrace,
  setNativeActiveSurface,
} from './anr-telemetry';
import { recordCrashBreadcrumb } from './crash-diagnostics';

export type PerformanceSurface = 'gadget_pattern' | 'home';

type ActiveSurface = {
  focused: boolean;
  instanceId: string;
  surface: PerformanceSurface;
};

const activeSurfaces = new Map<string, ActiveSurface>();

function resolveInstanceId(
  surface: PerformanceSurface,
  details: Record<string, unknown>
): string {
  return typeof details.instance_id === 'string' &&
    details.instance_id.length > 0
    ? details.instance_id
    : surface;
}

function resolveActiveSurface(): ActiveSurface | null {
  const surfaces = [...activeSurfaces.values()];
  return surfaces.at(-1) ?? null;
}

export function recordPerformanceSurface(
  surface: PerformanceSurface,
  details: Record<string, unknown> = {}
): void {
  const instanceId = resolveInstanceId(surface, details);
  const key = `${surface}:${instanceId}`;
  const activeSurface = {
    focused: details.focused !== false,
    instanceId,
    surface,
  } satisfies ActiveSurface;

  if (activeSurfaces.has(key)) {
    endNativeSurfaceTrace(surface, instanceId);
    activeSurfaces.delete(key);
  }
  activeSurfaces.set(key, activeSurface);
  setNativeActiveSurface(surface, instanceId, activeSurface.focused);
  beginNativeSurfaceTrace(surface, instanceId);

  const properties = { ...details, surface };
  recordCrashBreadcrumb(`performance:surface:${surface}`, properties);
  Sentry.addBreadcrumb({
    category: 'performance.surface',
    data: properties,
    level: 'info',
    message: surface,
  });
  trackEvent('performance_surface_attributed', properties);
}

export function clearPerformanceSurface(
  surface: PerformanceSurface,
  details: Record<string, unknown> = {}
): void {
  const instanceId = resolveInstanceId(surface, details);
  const key = `${surface}:${instanceId}`;
  if (activeSurfaces.delete(key)) {
    endNativeSurfaceTrace(surface, instanceId);
  }

  const nextSurface = resolveActiveSurface();
  if (nextSurface) {
    setNativeActiveSurface(
      nextSurface.surface,
      nextSurface.instanceId,
      nextSurface.focused
    );
  } else {
    setNativeActiveSurface('none', 'none', false);
  }
}

export function setPerformanceSurfaceFocus(
  surface: PerformanceSurface,
  focused: boolean,
  details: Record<string, unknown> = {}
): void {
  if (focused) {
    recordPerformanceSurface(surface, { ...details, focused: true });
    return;
  }

  clearPerformanceSurface(surface, details);
}
