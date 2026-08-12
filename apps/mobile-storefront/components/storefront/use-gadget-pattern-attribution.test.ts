import { renderHook } from '@testing-library/react-native';
import { recordCrashBreadcrumb } from '@/lib/crash-diagnostics';
import { recordPerformanceSurface } from '@/lib/performance-attribution';
import { useGadgetPatternAttribution } from './use-gadget-pattern-attribution';

jest.mock('@/lib/crash-diagnostics', () => ({
  recordCrashBreadcrumb: jest.fn(),
}));
jest.mock('@/lib/performance-attribution', () => ({
  recordPerformanceSurface: jest.fn(),
}));

describe('useGadgetPatternAttribution', () => {
  it('does not attribute skipped patterns', () => {
    renderHook(() => useGadgetPatternAttribution(false, 'default'));
    expect(recordPerformanceSurface).not.toHaveBeenCalled();
  });

  it('attributes rendered patterns and marks their unmount', () => {
    const { unmount } = renderHook(() =>
      useGadgetPatternAttribution(true, 'tabbar')
    );
    expect(recordPerformanceSurface).toHaveBeenCalledWith('gadget_pattern',
      expect.objectContaining({ os: expect.any(String), variant: 'tabbar' }));
    unmount();
    expect(recordCrashBreadcrumb).toHaveBeenCalledWith(
      'gadget_pattern:unmounted',
      expect.objectContaining({ variant: 'tabbar' })
    );
  });
});
