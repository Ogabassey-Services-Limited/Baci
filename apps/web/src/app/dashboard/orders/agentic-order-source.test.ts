import { describe, expect, it } from 'vitest';
import {
  AGENTIC_ORDER_SOURCE_FILTER,
  isAgenticOrderSource,
  parseAgenticOrderSourceFilter,
} from './agentic-order-source';

describe('agentic order source helpers', () => {
  it('parses the dashboard agentic source filter', () => {
    expect(parseAgenticOrderSourceFilter('agentic')).toBe(
      AGENTIC_ORDER_SOURCE_FILTER
    );
    expect(parseAgenticOrderSourceFilter(' Agentic ')).toBe(
      AGENTIC_ORDER_SOURCE_FILTER
    );
    expect(parseAgenticOrderSourceFilter(['agentic'])).toBe(
      AGENTIC_ORDER_SOURCE_FILTER
    );
  });

  it('ignores unsupported order source filters', () => {
    expect(parseAgenticOrderSourceFilter('whatsapp')).toBeUndefined();
    expect(parseAgenticOrderSourceFilter('')).toBeUndefined();
    expect(parseAgenticOrderSourceFilter('   ')).toBeUndefined();
    expect(parseAgenticOrderSourceFilter('Agentic!')).toBeUndefined();
    expect(parseAgenticOrderSourceFilter('agentic_ai ')).toBeUndefined();
    expect(parseAgenticOrderSourceFilter(null)).toBeUndefined();
    expect(parseAgenticOrderSourceFilter(undefined)).toBeUndefined();
    expect(parseAgenticOrderSourceFilter(123 as never)).toBeUndefined();
    expect(
      parseAgenticOrderSourceFilter([null, 'agentic'] as never)
    ).toBeUndefined();
    expect(parseAgenticOrderSourceFilter([' AGENTIC ', 'other'])).toBe(
      AGENTIC_ORDER_SOURCE_FILTER
    );
  });

  it('matches persisted agentic order rows', () => {
    expect(isAgenticOrderSource('agentic_ai')).toBe(true);
    expect(isAgenticOrderSource(' Agentic_AI ')).toBe(true);
    expect(isAgenticOrderSource('agentic')).toBe(false);
    expect(isAgenticOrderSource('agentic!')).toBe(false);
    expect(isAgenticOrderSource(123 as never)).toBe(false);
  });
});
