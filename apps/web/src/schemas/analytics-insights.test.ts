import { describe, expect, it } from 'vitest';
import { analyticsInsightsSchema } from './analytics-insights';

describe('analyticsInsightsSchema', () => {
  it('accepts valid AI insight payloads', () => {
    expect(
      analyticsInsightsSchema.safeParse({
        insights: [
          {
            title: 'Revenue grew',
            description: 'Paid orders increased week over week.',
            type: 'positive',
            priority: 'medium',
            action: 'Restock the top-selling SKU.',
          },
        ],
      }).success
    ).toBe(true);
  });

  it('rejects invalid insight classifications', () => {
    expect(
      analyticsInsightsSchema.safeParse({
        insights: [
          {
            title: 'Revenue grew',
            description: 'Paid orders increased week over week.',
            type: 'unsupported',
            priority: 'urgent',
          },
        ],
      }).success
    ).toBe(false);
  });
});
