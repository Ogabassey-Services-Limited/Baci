interface WebVitalMetricLike {
  name: string;
  attribution?: unknown;
}

/**
 * Pull the most useful per-metric attribution fields (the element selector +
 * timing sub-parts) so real-user reports show which node is the LCP / what
 * shifts (CLS) / what blocks interaction (INP), not just the score.
 */
export function extractWebVitalAttribution(
  metric: WebVitalMetricLike
): Record<string, string | number> {
  const attribution = metric.attribution;
  if (
    !attribution ||
    typeof attribution !== 'object' ||
    Array.isArray(attribution)
  ) {
    return {};
  }

  const source = attribution as Record<string, unknown>;
  const out: Record<string, string | number> = {};
  const pick = (key: string, label?: string) => {
    const value = source[key];
    if (typeof value === 'string' || typeof value === 'number') {
      out[label ?? key] = value;
    }
  };
  const pickFirst = (keys: string[], label: string) => {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' || typeof value === 'number') {
        out[label] = value;
        return;
      }
    }
  };

  if (metric.name === 'LCP') {
    pickFirst(['target', 'element'], 'debugTarget');
    pick('url', 'lcpUrl');
    pick('timeToFirstByte', 'ttfb');
    pick('resourceLoadDelay', 'loadDelay');
    pick('resourceLoadDuration', 'loadDuration');
    pick('elementRenderDelay', 'renderDelay');
  } else if (metric.name === 'CLS') {
    pick('largestShiftTarget', 'debugTarget');
    pick('largestShiftValue', 'shiftValue');
    pick('loadState');
  } else if (metric.name === 'INP') {
    pick('interactionTarget', 'debugTarget');
    pick('interactionType');
    pick('inputDelay');
    pick('processingDuration');
    pick('presentationDelay');
  }

  return out;
}
