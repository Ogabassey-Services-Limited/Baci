import { Systrace } from 'react-native';

type TraceDetails = Readonly<Record<string, unknown>>;

const NOOP = (): void => undefined;
const TRACE_PREFIX = 'baci.surface.';
const TRACE_DETAIL_KEYS = new Set([
  'api_level',
  'instance_id',
  'os',
  'renderer',
  'surface',
  'template_id',
  'variant',
]);

const toTraceArguments = (
  details: TraceDetails
): Record<string, string> | undefined => {
  const entries = Object.entries(details)
    .filter((entry): entry is [string, string | number | boolean] => {
      const [key, value] = entry;
      return (
        TRACE_DETAIL_KEYS.has(key) &&
        (typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean')
      );
    })
    .map(([key, value]) => [key, String(value).slice(0, 64)] as const);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

/**
 * Marks an active storefront surface in externally captured Android traces.
 * React Native makes this a cheap no-op unless system tracing is active.
 */
export function beginPerformanceTrace(
  surface: string,
  details: TraceDetails = {}
): () => void {
  if (typeof Systrace?.isEnabled !== 'function' || !Systrace.isEnabled()) {
    return NOOP;
  }

  const eventName = `${TRACE_PREFIX}${surface}`;
  const cookie = Systrace.beginAsyncEvent(eventName, toTraceArguments(details));
  let ended = false;

  return () => {
    if (ended) return;
    ended = true;
    Systrace.endAsyncEvent(eventName, cookie);
  };
}
