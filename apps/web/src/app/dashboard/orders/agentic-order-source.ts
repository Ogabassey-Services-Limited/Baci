export const AGENTIC_ORDER_SOURCE_FILTER = 'agentic';
export const AGENTIC_ORDER_SOURCE = 'agentic_ai';

export type AgenticOrderSourceFilter = typeof AGENTIC_ORDER_SOURCE_FILTER;

export function parseAgenticOrderSourceFilter(
  value: string | string[] | null | undefined
): AgenticOrderSourceFilter | undefined {
  const source = Array.isArray(value) ? value[0] : value;

  if (
    typeof source === 'string' &&
    source.trim().toLowerCase() === AGENTIC_ORDER_SOURCE_FILTER
  ) {
    return AGENTIC_ORDER_SOURCE_FILTER;
  }

  return undefined;
}

export function isAgenticOrderSource(
  value: string | null | undefined
): boolean {
  return (
    typeof value === 'string' &&
    value.trim().toLowerCase() === AGENTIC_ORDER_SOURCE
  );
}
