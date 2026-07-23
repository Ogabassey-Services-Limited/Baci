import { describe, expect, it } from 'vitest';
import { agenticDvaCutoverConstants } from './agentic-dva-cutover-constants';

describe('agenticDvaCutoverConstants', () => {
  it('keeps audit and drain on the same evidence columns and states', () => {
    expect(agenticDvaCutoverConstants.sessionSelect.split(', ')).toEqual([
      'session_id',
      'merchant_id',
      'status',
      'cart_items',
      'currency',
      'subtotal',
      'shipping_cost',
      'total_amount',
      'customer_email',
      'customer_name',
      'customer_phone',
      'shipping_address',
      'shipping_method',
      'order_id',
      'payment_method',
      'payment_provider',
      'payment_reference',
      'virtual_account_bank',
      'virtual_account_name',
      'virtual_account_number',
      'metadata',
      'updated_at',
    ]);
    expect(agenticDvaCutoverConstants.transitionalStates).toEqual([
      'claiming_payment',
      'payment_account_ready',
      'order_finalizing',
    ]);
    expect(agenticDvaCutoverConstants.claimingPaymentState).toBe(
      'claiming_payment'
    );
    expect(agenticDvaCutoverConstants.claimStaleMs).toBe(15 * 60 * 1000);
    expect(agenticDvaCutoverConstants.resumableStates).toEqual([
      'payment_account_ready',
      'order_finalizing',
    ]);
    expect(agenticDvaCutoverConstants.supportedCurrency).toBe('NGN');
  });
});
