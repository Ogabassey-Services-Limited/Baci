import { useEffect } from 'react';
import { Platform } from 'react-native';
import { recordCrashBreadcrumb } from '@/lib/crash-diagnostics';
import { recordPerformanceSurface } from '@/lib/performance-attribution';

export function useGadgetPatternAttribution(
  rendered: boolean,
  variant: 'default' | 'tabbar'
): void {
  useEffect(() => {
    if (!rendered) return;

    const details = {
      api_level:
        Platform.OS === 'android' ? Number(Platform.Version) : undefined,
      os: Platform.OS,
      variant,
    };
    recordPerformanceSurface('gadget_pattern', details);
    return () => recordCrashBreadcrumb('gadget_pattern:unmounted', details);
  }, [rendered, variant]);
}
