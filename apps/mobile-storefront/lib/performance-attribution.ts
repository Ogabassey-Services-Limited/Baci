import { recordCrashBreadcrumb } from './crash-diagnostics';
import * as Sentry from '@sentry/react-native';
import { trackEvent } from '@/services/analytics';

export type PerformanceSurface = 'gadget_pattern' | 'home';

const pendingAttributions: Array<{
  properties: Record<string, unknown>;
  surface: PerformanceSurface;
}> = [];

export function recordPerformanceSurface(
  surface: PerformanceSurface,
  details: Record<string, unknown> = {}
): void {
  const properties = { ...details, surface };
  recordCrashBreadcrumb(`performance:surface:${surface}`, properties);
  Sentry.addBreadcrumb({
    category: 'performance.surface',
    data: properties,
    level: 'info',
    message: surface,
  });
  pendingAttributions.push({ properties, surface });
}

export function flushPerformanceAttributions(): void {
  while (pendingAttributions.length > 0) {
    const attribution = pendingAttributions.shift();
    if (!attribution) return;
    trackEvent('performance_surface_attributed', attribution.properties);
  }
}
