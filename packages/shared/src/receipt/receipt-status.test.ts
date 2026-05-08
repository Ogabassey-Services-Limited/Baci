import { describe, expect, it } from 'vitest';
import { getReceiptStatusConfig } from './receipt-status';

describe('getReceiptStatusConfig', () => {
  it('returns paid receipt status styles', () => {
    expect(getReceiptStatusConfig('paid')).toEqual({
      label: 'PAID',
      color: '#059669',
      bg: 'rgba(5,150,105,0.06)',
      border: 'rgba(5,150,105,0.18)',
      watermark: 'rgba(5,150,105,0.07)',
      wmBorder: 'rgba(5,150,105,0.12)',
    });
  });

  it('returns partially paid receipt status styles', () => {
    expect(getReceiptStatusConfig('partially_paid')).toEqual({
      label: 'PARTIALLY PAID',
      color: '#d97706',
      bg: 'rgba(217,119,6,0.06)',
      border: 'rgba(217,119,6,0.18)',
      watermark: 'rgba(217,119,6,0.07)',
      wmBorder: 'rgba(217,119,6,0.12)',
    });
  });

  it('returns unpaid receipt status styles by default', () => {
    expect(getReceiptStatusConfig('unknown')).toEqual({
      label: 'UNPAID',
      color: '#dc2626',
      bg: 'rgba(220,38,38,0.06)',
      border: 'rgba(220,38,38,0.18)',
      watermark: 'rgba(220,38,38,0.07)',
      wmBorder: 'rgba(220,38,38,0.12)',
    });
  });
});
