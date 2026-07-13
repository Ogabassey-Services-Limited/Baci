import { describe, expect, it } from 'vitest';
import { buildPetrockRemediationNotification } from './petrock-remediation-notification-content';

describe('buildPetrockRemediationNotification', () => {
  it('builds customer-safe completion copy with a tracking deep link', () => {
    const content = buildPetrockRemediationNotification({
      amount: 65,
      carrier: 'AT&T',
      currency: 'USDT',
      customerName: 'Ada',
      merchantName: 'Ogabassey',
      status: 'completed',
      storefrontUrl: 'https://ogabassey.usebaci.com',
    });

    expect(content.title).toBe('Carrier unlock complete');
    expect(content.body).toContain('AT&T');
    expect(content.textContent).toContain(
      'https://ogabassey.usebaci.com/unlock-orders'
    );
    expect(content.htmlContent).toContain('65.00 USDT');
    expect(JSON.stringify(content)).not.toMatch(/imei|identifier/i);
  });

  it('does not promise a refund for a non-refundable denial', () => {
    const content = buildPetrockRemediationNotification({
      amount: 100_000,
      carrier: 'AT&T',
      currency: 'NGN',
      customerName: '<Ada>',
      merchantName: 'Ogabassey',
      status: 'failed',
      storefrontUrl: 'https://ogabassey.usebaci.com',
    });

    expect(content.body).not.toMatch(/refund/i);
    expect(content.htmlContent).not.toContain('<Ada>');
    expect(content.htmlContent).toContain('&lt;Ada&gt;');
  });

  it('rejects a non-http storefront URL before composing the email', () => {
    expect(() =>
      buildPetrockRemediationNotification({
        amount: 65,
        carrier: 'AT&T',
        currency: 'USDT',
        customerName: 'Ada',
        merchantName: 'Ogabassey',
        status: 'completed',
        storefrontUrl: 'javascript:alert(1)',
      })
    ).toThrow('Invalid storefront URL');
  });
});
