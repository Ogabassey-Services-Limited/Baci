import { describe, expect, it } from 'vitest';
import { buildPetrockRemediationCatalogRows } from './petrock-remediation-catalog';

describe('buildPetrockRemediationCatalogRows', () => {
  it('converts every IMEI product into inactive auditable curation output', () => {
    const rows = buildPetrockRemediationCatalogRows([
      {
        active: true,
        category_id: 'C210',
        category_name: 'AT&T USA Network Unlock',
        currency: 'USD',
        input_fields: [{ name: 'IMEI' }],
        name: 'AT&T Clean Unlock - All iPhone Models',
        order_field_name: 'IMEI',
        price_usd: 75,
        product_id: 'unlock-1',
        provider: 'petrock',
        raw_product: {},
        synced_at: '2026-07-11T00:00:00.000Z',
        turnaround: '1-7 Days',
        type: 'imei',
      },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        carrier: 'AT&T',
        model_scope: { family: 'iphone', kind: 'generic' },
        provider_product_id: 'unlock-1',
      }),
    ]);
    expect(rows[0]).not.toHaveProperty('is_active');
    expect(rows[0]).not.toHaveProperty('review_status');
  });
});
