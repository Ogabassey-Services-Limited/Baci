import { describe, expect, it } from 'vitest';
import type {
  PaymentStatusResult,
  ProductSearchResult,
  VirtualAccountResult,
} from './chat-tool-result-types';

// chat-tool-result-types.ts is a pure type module (interfaces only). These
// assertions pin the result shapes so a breaking change to a handler's return
// contract is caught at compile time.
describe('chat tool result types', () => {
  it('describes a product search result', () => {
    const product: ProductSearchResult = {
      id: 'p1',
      name: 'Phone',
      price: 1000,
      description: null,
      brand: null,
      category: null,
      image_url: null,
      stock: null,
      status: 'active',
    };

    expect(product.status).toBe('active');
  });

  it('describes virtual-account and payment-status results', () => {
    const virtualAccount: VirtualAccountResult = {
      success: false,
      error: 'Bank transfer temporarily unavailable',
    };
    const paymentStatus: PaymentStatusResult = { status: 'not_found' };

    expect(virtualAccount.success).toBe(false);
    expect(paymentStatus.status).toBe('not_found');
  });
});
