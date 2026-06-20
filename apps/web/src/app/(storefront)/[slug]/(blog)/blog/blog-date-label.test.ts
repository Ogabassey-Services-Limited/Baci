import { describe, expect, it } from 'vitest';
import { formatBlogListDateLabel } from './blog-date-label';

describe('formatBlogListDateLabel', () => {
  it('formats published dates with a fixed locale and UTC time zone', () => {
    expect(formatBlogListDateLabel('2026-03-28T23:30:00.000Z')).toBe(
      '28 Mar 2026'
    );
  });

  it('returns null for invalid published dates', () => {
    expect(formatBlogListDateLabel('not-a-date')).toBeNull();
  });
});
