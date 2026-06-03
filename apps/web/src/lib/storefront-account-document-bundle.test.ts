import { describe, expect, it } from 'vitest';
import { buildStorefrontAccountDocumentBundle } from '@/lib/storefront-account-document-bundle';

describe('buildStorefrontAccountDocumentBundle', () => {
  it('builds invoice, receipt, and order payloads from normalized input data', () => {
    const result = buildStorefrontAccountDocumentBundle({
      merchant: {
        business_name: 'Ogabassey',
        logo_url: 'https://example.com/logo.png',
        email: 'merchant@example.com',
        phone: '08000000000',
        support_email: 'support@example.com',
        support_phone: '08011111111',
        business_address: '12 Allen Avenue',
        cac_rc_number: 'RC123',
        tax_identification_number: 'TIN123',
        legal_entity_name: 'Ogabassey Ltd',
        brand_colors: { primary: '#000000' },
        vat_registration_status: 'registered',
        vat_rate: 7.5,
        bank_code: '999',
        bank_account_number: '1234567890',
        bank_name: 'Baci Bank',
        bank_account_name: 'Ogabassey Ltd',
        social_media: { instagram: '@ogabassey' },
        pages: { about: true },
        registered_address: {
          street: '12 Allen Avenue',
          city: 'Lagos',
          state: 'Lagos',
          postal_code: '100001',
          country: 'NG',
        },
      },
      customer: {
        first_name: 'Oga',
        last_name: 'Bassey',
        email: 'customer@example.com',
        phone: '08022222222',
      },
      order: {
        id: 'order-1',
        order_number: 'ORD-1001',
        created_at: '2026-03-22T10:00:00.000Z',
        updated_at: '2026-03-22T11:00:00.000Z',
        payment_status: 'paid',
        shipping_status: 'shipped',
        currency: 'NGN',
        total: 110000,
        subtotal: 100000,
        shipping_fee: 5000,
        tax_amount: 5000,
        discount_amount: 0,
        amount_paid: 110000,
        shipping_address: {
          address_line1: '12 Allen Avenue',
          city: 'Lagos',
          state: 'Lagos',
          postal_code: '100001',
          country: 'NG',
        },
        customer_name: null,
        customer_email: null,
        customer_phone: null,
        payment_method: 'card',
        is_credit_order: false,
        tracking_number: 'TRACK-1',
        shipping_provider: 'GIGL',
        notes: 'Leave at the gate',
        invoice_type_code: '380',
        invoice_issue_date: null,
        tax_point_date: null,
        payment_due_date: null,
        buyer_reference: null,
        purchase_order_reference: null,
        tax_exclusive_amount: 100000,
        tax_inclusive_amount: 110000,
        invoice_note: null,
        firs_irn: 'IRN-2026-001',
        firs_csid: 'CSID-2026-001',
        firs_qr_code: null,
        payment_terms: null,
      },
      itemRows: [
        {
          id: 'item-1',
          product_id: 'prod-1',
          variant_id: null,
          variant_name: 'Blue / 128GB',
          name: 'iPhone 16',
          quantity: 1,
          price: 100000,
          fulfillment_data: {
            imei: 'IMEI-123',
            serial_number: 'SN-456',
          },
        },
      ],
      transactions: [
        {
          id: 'tx-1',
          amount: 110000,
          created_at: '2026-03-22T10:10:00.000Z',
          description: 'Card payment',
          metadata: { payment_method: 'card' },
        },
      ],
      paymentAccount: {
        account_number: '1234567890',
        bank_name: 'Baci Bank',
        account_name: 'Ogabassey Ltd',
      },
      taxRows: [],
      paymentStatus: 'paid',
      shippingStatus: 'shipped',
      currentDocumentKind: 'receipt',
    });

    expect(result.order.current_document_kind).toBe('receipt');
    expect(result.order.receipt_eligible).toBe(true);
    expect(result.order.customer_name).toBe('Oga Bassey');
    expect(result.invoiceData.items[0]?.name).toBe('iPhone 16 (Blue / 128GB)');
    expect(result.invoiceData.items[0]?.description).toContain(
      'IMEI: IMEI-123'
    );
    expect(result.invoiceData.items[0]?.description).toContain('S/N: SN-456');
    expect(result.invoiceData.items[0]?.vat_amount).toBe(5000);
    expect(result.invoiceData.items[0]?.vat_category_code).toBe('S');
    expect(result.invoiceData.amount_paid).toBe(110000);
    expect(result.invoiceData.firs_irn).toBe('IRN-2026-001');
    expect(result.order.transactions?.[0]?.id).toBe('tx-1');
    expect(result.receiptOrder.virtual_account?.account_number).toBe(
      '1234567890'
    );
    expect(result.invoiceData.customer.address?.street).toBe('12 Allen Avenue');
    expect(result.invoiceData.tax_subtotals).toEqual([
      {
        vat_category_code: 'S',
        vat_rate: 7.5,
        taxable_amount: 100000,
        tax_amount: 5000,
      },
    ]);
  });

  it('falls back to invoice mode and zero-safe numeric coercion', () => {
    const result = buildStorefrontAccountDocumentBundle({
      merchant: {
        business_name: 'Ogabassey',
        logo_url: null,
        email: null,
        phone: null,
        support_email: null,
        support_phone: null,
        business_address: null,
        cac_rc_number: null,
        tax_identification_number: null,
        legal_entity_name: null,
        brand_colors: null,
        vat_registration_status: null,
        vat_rate: 0,
        bank_code: null,
        bank_account_number: null,
        bank_name: null,
        bank_account_name: null,
        social_media: null,
        pages: null,
        registered_address: null,
      },
      customer: {
        first_name: null,
        last_name: null,
        email: null,
        phone: null,
      },
      order: {
        id: 'order-2',
        order_number: 'ORD-1002',
        created_at: '2026-03-22T10:00:00.000Z',
        updated_at: null,
        payment_status: null,
        shipping_status: null,
        currency: null,
        total: '0',
        subtotal: '0',
        shipping_fee: null,
        tax_amount: null,
        discount_amount: null,
        amount_paid: null,
        shipping_address: 'Pickup',
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        payment_method: null,
        is_credit_order: null,
        tracking_number: null,
        shipping_provider: null,
        notes: null,
        invoice_type_code: null,
        invoice_issue_date: null,
        tax_point_date: null,
        payment_due_date: null,
        buyer_reference: null,
        purchase_order_reference: null,
        tax_exclusive_amount: null,
        tax_inclusive_amount: null,
        invoice_note: null,
        firs_irn: null,
        firs_csid: null,
        firs_qr_code: null,
        payment_terms: null,
      },
      itemRows: [],
      transactions: [],
      paymentAccount: null,
      taxRows: [],
      paymentStatus: '',
      shippingStatus: '',
      currentDocumentKind: 'invoice',
    });

    expect(result.order.current_document_kind).toBe('invoice');
    expect(result.order.receipt_eligible).toBe(false);
    expect(result.order.currency).toBe('NGN');
    expect(result.receiptOrder.customer_name).toBe('Customer');
    expect(result.invoiceData.items).toEqual([]);
    expect(result.invoiceData.tax_exclusive_amount).toBe(0);
    expect(result.invoiceData.tax_inclusive_amount).toBe(0);
    expect(result.invoiceData.merchant.vat_rate).toBe(0);
    expect(result.invoiceData.customer.address?.street).toBe('Pickup');
  });

  it('omits blanket line VAT metadata when multiple tax buckets are present', () => {
    const result = buildStorefrontAccountDocumentBundle({
      merchant: {
        business_name: 'Ogabassey',
        logo_url: null,
        email: null,
        phone: null,
        support_email: null,
        support_phone: null,
        business_address: null,
        cac_rc_number: null,
        tax_identification_number: null,
        legal_entity_name: null,
        brand_colors: null,
        vat_registration_status: null,
        vat_rate: 7.5,
        bank_code: null,
        bank_account_number: null,
        bank_name: null,
        bank_account_name: null,
        social_media: null,
        pages: null,
        registered_address: null,
      },
      customer: {
        first_name: 'Oga',
        last_name: 'Bassey',
        email: 'customer@example.com',
        phone: null,
      },
      order: {
        id: 'order-3',
        order_number: 'ORD-1003',
        created_at: '2026-03-22T10:00:00.000Z',
        updated_at: null,
        payment_status: 'paid',
        shipping_status: 'shipped',
        currency: 'NGN',
        total: 109000,
        subtotal: 100000,
        shipping_fee: 4000,
        tax_amount: 5000,
        discount_amount: 0,
        amount_paid: 109000,
        shipping_address: null,
        customer_name: null,
        customer_email: null,
        customer_phone: null,
        payment_method: 'card',
        is_credit_order: false,
        tracking_number: null,
        shipping_provider: null,
        notes: null,
        invoice_type_code: null,
        invoice_issue_date: null,
        tax_point_date: null,
        payment_due_date: null,
        buyer_reference: null,
        purchase_order_reference: null,
        tax_exclusive_amount: null,
        tax_inclusive_amount: 109000,
        invoice_note: null,
        firs_irn: null,
        firs_csid: null,
        firs_qr_code: null,
        payment_terms: null,
      },
      itemRows: [
        {
          id: 'item-1',
          product_id: 'prod-1',
          variant_id: null,
          variant_name: null,
          name: 'Mixed Tax Item',
          quantity: 1,
          price: 100000,
        },
      ],
      transactions: [],
      paymentAccount: null,
      taxRows: [
        {
          vat_category_code: 'S',
          vat_rate: 7.5,
          taxable_amount: 70000,
          tax_amount: 3500,
          exemption_reason: null,
        },
        {
          vat_category_code: 'E',
          vat_rate: 0,
          taxable_amount: 30000,
          tax_amount: 1500,
          exemption_reason: 'Mixed exemption',
        },
      ],
      paymentStatus: 'paid',
      shippingStatus: 'shipped',
      currentDocumentKind: 'receipt',
    });

    expect(result.invoiceData.items[0]).not.toHaveProperty('vat_category_code');
    expect(result.invoiceData.items[0]).not.toHaveProperty('vat_rate');
    expect(result.invoiceData.items[0]).not.toHaveProperty('vat_amount');
    expect(result.invoiceData.tax_exclusive_amount).toBe(104000);
  });
});
