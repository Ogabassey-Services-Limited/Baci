import { recordCrashBreadcrumb } from './crash-diagnostics';
import { trackEvent } from '@/services/analytics';

export type PerformanceSurface = 'gadget_pattern' | 'home';

export function recordPerformanceSurface(
  surface: PerformanceSurface,
  details: Record<string, unknown> = {}
): void {
  const properties = { ...details, surface };
  recordCrashBreadcrumb(`performance:surface:${surface}`, properties);
  trackEvent('performance_surface_attributed', properties);
}
