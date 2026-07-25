import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const checkoutPageSource = readFileSync(
  resolve(import.meta.dirname, 'page.tsx'),
  'utf8'
);

describe('bugfix: legacy Credit Direct checkout wiring', () => {
  it('normalizes canonical order items before signing and carries them to the popup', () => {
    expect(checkoutPageSource).toContain(
      'prepareLegacyCreditDirectCheckout(\n        orderItems,\n        Number(order.total)'
    );
    expect(checkoutPageSource).toContain('totalAmount: amounts.totalAmount');
    expect(checkoutPageSource).toContain(
      "return {\n        kind: 'credit_direct',\n        order,\n        sign: signResult.data,\n        orderItems,"
    );
    expect(checkoutPageSource).toContain(
      'openCreditDirectPopup(result.order, result.sign, result.orderItems, data)'
    );
  });

  it('uses the server-signed amount with the canonical order items', () => {
    expect(checkoutPageSource).toContain('signedAmount: sign.amount');
    expect(checkoutPageSource).toContain(
      'orderId: order.id as string,\n        orderItems,'
    );
  });

  it('reports preparation failures and clears the loading state', () => {
    expect(checkoutPageSource).toContain(
      'transaction = buildLegacyCreditDirectTransaction'
    );
    expect(checkoutPageSource).toContain(
      "title: 'BNPL Checkout Failed',\n        description:"
    );
    expect(checkoutPageSource).toContain(
      "error instanceof Error\n            ? error.message\n            : 'Failed to start Credit Direct checkout'"
    );
    expect(checkoutPageSource).toContain(
      'setFormIsLoading(false);\n      return;'
    );
  });
});
