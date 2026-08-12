import { recordCrashBreadcrumb } from './crash-diagnostics';
import { recordPerformanceSurface } from './performance-attribution';
import { trackEvent } from '@/services/analytics';

jest.mock('./crash-diagnostics', () => ({
  recordCrashBreadcrumb: jest.fn(),
}));

jest.mock('@/services/analytics', () => ({
  trackEvent: jest.fn(),
}));

describe('performance attribution', () => {
  it('stamps the same bounded surface context into crash and analytics telemetry', () => {
    recordPerformanceSurface('gadget_pattern', {
      api_level: 28,
      os: 'android',
      variant: 'hero',
    });

    expect(recordCrashBreadcrumb).toHaveBeenCalledWith(
      'performance:surface:gadget_pattern',
      { api_level: 28, os: 'android', surface: 'gadget_pattern', variant: 'hero' }
    );
    expect(trackEvent).toHaveBeenCalledWith('performance_surface_attributed', {
      api_level: 28,
      os: 'android',
      surface: 'gadget_pattern',
      variant: 'hero',
    });
  });
});
