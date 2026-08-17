import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { trackEvent } from '@/services/analytics';
import { recordCrashBreadcrumb } from './crash-diagnostics';
import {
  clearPerformanceSurface,
  recordPerformanceSurface,
  setPerformanceSurfaceFocus,
} from './performance-attribution';

jest.mock('./crash-diagnostics', () => ({
  recordCrashBreadcrumb: jest.fn(),
}));

jest.mock('@/services/analytics', () => ({
  trackEvent: jest.fn(),
}));

jest.mock('./anr-telemetry', () => ({
  beginNativeSurfaceTrace: jest.fn(),
  endNativeSurfaceTrace: jest.fn(),
  setNativeActiveSurface: jest.fn(),
}));

jest.mock('@sentry/react-native', () => ({ addBreadcrumb: jest.fn() }));

const mockNativeTelemetry = jest.requireMock('./anr-telemetry') as {
  beginNativeSurfaceTrace: jest.Mock;
  endNativeSurfaceTrace: jest.Mock;
  setNativeActiveSurface: jest.Mock;
};

describe('performance attribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    clearPerformanceSurface('gadget_pattern');
    clearPerformanceSurface('home');
  });

  it('stamps the same bounded surface context into crash and analytics telemetry', () => {
    recordPerformanceSurface('gadget_pattern', {
      api_level: 28,
      os: 'android',
      variant: 'hero',
    });

    expect(recordCrashBreadcrumb).toHaveBeenCalledWith(
      'performance:surface:gadget_pattern',
      {
        api_level: 28,
        os: 'android',
        surface: 'gadget_pattern',
        variant: 'hero',
      }
    );
    expect(trackEvent).toHaveBeenCalledWith('performance_surface_attributed', {
      api_level: 28,
      os: 'android',
      surface: 'gadget_pattern',
      variant: 'hero',
    });
    expect(mockNativeTelemetry.setNativeActiveSurface).toHaveBeenCalledWith(
      'gadget_pattern',
      'gadget_pattern',
      true
    );
    expect(mockNativeTelemetry.beginNativeSurfaceTrace).toHaveBeenCalledWith(
      'gadget_pattern',
      'gadget_pattern'
    );
  });

  it('ends the native trace and clears the marker when a surface unmounts', () => {
    recordPerformanceSurface('gadget_pattern', {
      instance_id: 'gadget_pattern_1',
    });

    clearPerformanceSurface('gadget_pattern', {
      instance_id: 'gadget_pattern_1',
    });

    expect(mockNativeTelemetry.endNativeSurfaceTrace).toHaveBeenCalledWith(
      'gadget_pattern',
      'gadget_pattern_1'
    );
    expect(mockNativeTelemetry.setNativeActiveSurface).toHaveBeenLastCalledWith(
      'none',
      'none',
      false
    );
  });

  it('removes only the focused home marker when a tab loses focus', () => {
    setPerformanceSurfaceFocus('home', true, { template_id: 'default' });
    setPerformanceSurfaceFocus('home', false, {
      template_id: 'default',
    });

    expect(mockNativeTelemetry.endNativeSurfaceTrace).toHaveBeenCalledWith(
      'home',
      'home'
    );
    expect(mockNativeTelemetry.setNativeActiveSurface).toHaveBeenLastCalledWith(
      'none',
      'none',
      false
    );
  });
});
