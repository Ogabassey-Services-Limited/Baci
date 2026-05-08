import type { ReceiptMerchant, ReceiptOrder } from './types';

function createReceiptOrder(
  overrides: Partial<ReceiptOrder> = {}
): ReceiptOrder {
  return {
    order_number: 'ORD-123',
    created_at: '2026-04-08T18:02:55.974Z',
    currency: 'NGN',
    total: 500000,
    subtotal: 500000,
    shipping_fee: 0,
    tax_amount: 0,
    discount_amount: 0,
    amount_paid: 500000,
    balance: 0,
    payment_status: 'paid',
    payment_method: 'card',
    customer_name: 'Akinola Ogunniran',
    customer_email: 'akin@example.com',
    customer_phone: null,
    items: [
      {
        product_name: 'Samsung Galaxy S22 Ultra',
        variant_name: 'Black / 256GB',
        quantity: 1,
        price: 500000,
      },
    ],
    ...overrides,
  };
}

function createReceiptMerchant(
  overrides: Partial<ReceiptMerchant> = {}
): ReceiptMerchant {
  return {
    business_name: 'Ogabassey',
    logo_url: null,
    email: 'hello@example.com',
    phone: null,
    support_email: null,
    support_phone: null,
    business_address: null,
    cac_rc_number: null,
    tax_identification_number: null,
    legal_entity_name: null,
    vat_registration_status: null,
    vat_rate: null,
    bank_code: null,
    bank_account_number: null,
    ...overrides,
  };
}

export const receiptTestFactory = {
  createReceiptMerchant,
  createReceiptOrder,
};
