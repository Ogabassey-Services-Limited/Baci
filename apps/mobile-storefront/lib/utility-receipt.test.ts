import { buildUtilityReceiptHtml } from '@/lib/utility-receipt';

describe('utility-receipt', () => {
  it('builds an escaped receipt with the electricity token', () => {
    const html = buildUtilityReceiptHtml({
      amount: 1000,
      customerIdentifier: '43901766923',
      reference: 'ref-123',
      status: 'successful',
      type: 'power',
      voucherPin: '<token-123>',
    });

    expect(html).toContain('Electricity Receipt');
    expect(html).toContain('₦1,000');
    expect(html).toContain('43901766923');
    expect(html).toContain('&lt;token-123&gt;');
    expect(html).not.toContain('<token-123>');
  });
});
