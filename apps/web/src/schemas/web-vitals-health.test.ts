import { describe, expect, it } from 'vitest';
import { postHogWebVitalsQueryResponseSchema } from './web-vitals-health';

describe('postHogWebVitalsQueryResponseSchema', () => {
  it('accepts a HogQL response with numeric, string, and null cells', () => {
    // Arrange
    const payload = {
      columns: ['web_vitals_total', 'lcp'],
      results: [[483, '90', null]],
    };

    // Act
    const parsed = postHogWebVitalsQueryResponseSchema.safeParse(payload);

    // Assert
    expect(parsed.success).toBe(true);
  });

  it('accepts an empty results array (empty 24h window)', () => {
    const parsed = postHogWebVitalsQueryResponseSchema.safeParse({
      results: [],
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects a response whose results are not a matrix', () => {
    // Arrange
    const payload = { results: { web_vitals_total: 1 } };

    // Act
    const parsed = postHogWebVitalsQueryResponseSchema.safeParse(payload);

    // Assert
    expect(parsed.success).toBe(false);
  });

  it('rejects cells that are neither number, string, nor null', () => {
    const parsed = postHogWebVitalsQueryResponseSchema.safeParse({
      results: [[{ nested: true }]],
    });

    expect(parsed.success).toBe(false);
  });
});
