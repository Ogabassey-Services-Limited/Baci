import { describe, expect, it } from 'vitest';
import { buildSettlementNotificationEmail } from './build-settlement-notification-email';

describe('buildSettlementNotificationEmail', () => {
  it('includes merchant settlement details and the wallet link', () => {
    const message = buildSettlementNotificationEmail({
      businessName: 'Merchant Shop',
      email: 'merchant@example.com',
      settlements: [
        {
          amount: 2500,
          description: 'Order ORD-1',
          gateway: 'paystack',
          id: 'settlement-1',
        },
      ],
      totalAmount: 2500,
    });

    expect(message).toMatchObject({
      emailType: 'notifications',
      to: 'merchant@example.com',
      toName: 'Merchant Shop',
    });
    expect(message.htmlContent).toContain('Order ORD-1');
    expect(message.htmlContent).toContain(
      'dashboard.usebaci.com/dashboard/wallet'
    );
  });
});
