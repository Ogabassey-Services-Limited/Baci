import { useEffect, useId } from 'react';

/**
 * A hook to measure the duration of a component's lifecycle or specific events using the User Timing API.
 *
 * @param name The base name for the measure.
 * @param enabled Whether to enable the measurement. Defaults to true.
 */
export function useUserTiming(name: string, enabled: boolean = true) {
  // Use React's useId for stable, unique identifier (avoids Math.random during render)
  const componentId = useId();

  useEffect(() => {
    if (!enabled || typeof performance === 'undefined') return;

    const markNameStart = `${name}-${componentId}-start`;
    const markNameEnd = `${name}-${componentId}-end`;
    const measureName = `${name}`;

    performance.mark(markNameStart);

    return () => {
      performance.mark(markNameEnd);
      try {
        performance.measure(measureName, markNameStart, markNameEnd);
      } catch (_e) {
        // Ignore errors if marks are missing
      }

      // Cleanup marks to avoid memory leaks in long-running apps
      performance.clearMarks(markNameStart);
      performance.clearMarks(markNameEnd);
      // We generally don't clear measures immediately so they can be observed
    };
  }, [name, enabled, componentId]);
}
