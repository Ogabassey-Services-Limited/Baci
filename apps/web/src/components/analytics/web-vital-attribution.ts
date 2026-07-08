import { redactUrlQuery } from '@/lib/posthog/boot-free-capture';

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
    // Long Animation Frames (LoAF) breakdown — identifies WHICH scripts own
    // the long frame; prerequisite for the PR-WEIGHT diagnose-then-fix INP
    // work (web-vitals v5 attribution build; LoAF stable since Chrome 123).
    pick('totalScriptDuration', 'loafScriptDuration');
    pick('totalStyleAndLayoutDuration', 'loafStyleLayoutDuration');
    pick('totalPaintDuration', 'loafPaintDuration');
    pick('totalUnattributedDuration', 'loafUnattributedDuration');
    const longestScript = source.longestScript;
    if (longestScript && typeof longestScript === 'object') {
      const script = longestScript as {
        subpart?: unknown;
        intersectingDuration?: unknown;
        entry?: { sourceURL?: unknown; invoker?: unknown };
      };
      if (typeof script.subpart === 'string') {
        out.loafLongestScriptSubpart = script.subpart;
      }
      if (typeof script.intersectingDuration === 'number') {
        out.loafLongestScriptDuration = script.intersectingDuration;
      }
      const entry = script.entry;
      if (entry && typeof entry === 'object') {
        if (typeof entry.sourceURL === 'string' && entry.sourceURL) {
          // Strip the script URL's query/hash before capture: it can carry
          // cache-bust hashes or signed tokens (leak risk) and its key does
          // not match the sanitizer's URL_PROPERTY_PATTERN, so neither the
          // booted before_send path nor the page-hide beacon would redact it.
          // The path alone identifies which chunk owns the long frame.
          out.loafLongestScriptSource = redactUrlQuery(entry.sourceURL);
        }
        if (typeof entry.invoker === 'string' && entry.invoker) {
          // Same redaction as sourceURL: for classic/module scripts the LoAF
          // spec returns the script URL as `invoker`, and event-listener
          // invokers can embed a target src — both can carry query tokens.
          // Plain invoker names ("DOMWindow.onpointerdown") contain no ?/#
          // and pass through unchanged.
          out.loafLongestScriptInvoker = redactUrlQuery(entry.invoker);
        }
      }
    }
  }

  return out;
}
