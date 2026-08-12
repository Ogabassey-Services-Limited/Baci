import { useEffect, useRef } from 'react';
import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import { recordCrashBreadcrumb } from '@/lib/crash-diagnostics';
import { recordPerformanceSurface } from '@/lib/performance-attribution';

let nextGadgetPatternId = 0;

export function useGadgetPatternAttribution(
  rendered: boolean,
  variant: 'default' | 'tabbar'
): void {
  const recorded = useRef(false);
  const instanceId = useRef(`gadget_pattern_${nextGadgetPatternId++}`);

  if (rendered && !recorded.current) {
    recorded.current = true;
    recordPerformanceSurface('gadget_pattern', {
      api_level:
        Platform.OS === 'android' ? Number(Platform.Version) : undefined,
      os: Platform.OS,
      variant,
    });
  }

  useEffect(() => {
    if (!rendered) return;

    const details = {
      api_level:
        Platform.OS === 'android' ? Number(Platform.Version) : undefined,
      os: Platform.OS,
      variant,
    };
    return () => {
      recordCrashBreadcrumb(`gadget_pattern:unmounted:${instanceId.current}`, {
        ...details,
        instance_id: instanceId.current,
      });
      Sentry.addBreadcrumb({
        category: 'performance.surface',
        data: { ...details, instance_id: instanceId.current },
        level: 'info',
        message: `gadget_pattern:unmounted:${variant}:${instanceId.current}`,
      });
    };
  }, [rendered, variant]);
}
