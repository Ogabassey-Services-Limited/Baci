// @vitest-environment node

import { describe, expect, it } from 'vitest';
import type { InvoiceData } from '@/lib/invoice-generator';
import {
  generatePeppolInvoiceXml,
  generatePeppolInvoiceXmlBlob,
  PEPPOL_BIS_BILLING_COMPLIANCE_NOTE,
} from '@/lib/peppol-ubl-invoice';

function createInvoiceData(overrides: Partial<InvoiceData> = {}): InvoiceData {
  return {
    invoice_number: 'INV-2026-001',
    invoice_type_code: '380',
    issue_date: new Date('2026-05-30T00:00:00.000Z'),
    due_date: new Date('2026-06-06T00:00:00.000Z'),
    currency: 'NGN',
    buyer_reference: 'buyer-ref-1',
    merchant: {
      business_name: 'Ogabassey',
      legal_entity_name: 'Ogabassey Limited',
      tax_identification_number: 'TIN-123456',
      cac_rc_number: 'RC-123456',
      vat_registration_status: 'registered',
      vat_rate: 7.5,
      registered_address: {
        street: '12 Allen Avenue',
        city: 'Ikeja',
        state: 'Lagos',
        postal_code: '100271',
        country: 'NG',
      },
      support_email: 'support@example.com',
      support_phone: '+2348012345678',
    },
    customer: {
      name: 'Akinola Ogunniran',
      email: 'akin@example.com',
      phone: '+2348098765432',
      address: {
        street: '8 Marina Road',
        city: 'Lagos Island',
        state: 'Lagos',
        postal_code: '101001',
        country: 'NG',
      },
    },
    items: [
      {
        line_id: 1,
        name: 'Samsung Galaxy S24 Ultra',
        description: 'Unlocked 256GB device',
        quantity: 1,
        unit_code: 'EA',
        price: 500000,
        line_extension_amount: 500000,
        vat_category_code: 'S',
        vat_rate: 7.5,
        vat_amount: 37500,
        sellers_item_id: 'SKU-S24-256',
      },
    ],
    tax_subtotals: [
      {
        vat_category_code: 'S',
        vat_rate: 7.5,
        taxable_amount: 500000,
        tax_amount: 37500,
      },
    ],
    subtotal: 500000,
    tax_exclusive_amount: 505000,
    tax_amount: 37500,
    tax_inclusive_amount: 542500,
    shipping_fee: 5000,
    discount_amount: 0,
    total: 542500,
    notes: 'Thank you for shopping with us.',
    payment_terms: 'Due on receipt',
    ...overrides,
  };
}

describe('generatePeppolInvoiceXml', () => {
  it('generates a UBL invoice with required Peppol billing fields', () => {
    const xml = generatePeppolInvoiceXml(createInvoiceData());

    expect(xml).toContain(
      '<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>'
    );
    expect(xml).toContain(
      '<cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>'
    );
    expect(xml).toContain('<cbc:ID>INV-2026-001</cbc:ID>');
    expect(xml).toContain('<cbc:IssueDate>2026-05-30</cbc:IssueDate>');
    expect(xml).toContain('<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>');
    expect(xml).toContain(
      '<cbc:DocumentCurrencyCode>NGN</cbc:DocumentCurrencyCode>'
    );
    expect(xml).toContain('<cac:AccountingSupplierParty>');
    expect(xml).toContain('<cac:AccountingCustomerParty>');
    expect(xml).toContain('<cac:LegalMonetaryTotal>');
    expect(xml).toContain('<cac:InvoiceLine>');
  });

  it('escapes unsafe invoice text', () => {
    const xml = generatePeppolInvoiceXml(
      createInvoiceData({
        customer: {
          name: `Akin & Sons <Buyer> "Prime"`,
        },
        items: [
          {
            line_id: 1,
            name: `Phone & Case <Bundle> 'Limited'`,
            quantity: 1,
            unit_code: 'EA',
            price: 1000,
            line_extension_amount: 1000,
            vat_category_code: 'O',
            vat_rate: 0,
            vat_amount: 0,
          },
        ],
        tax_subtotals: [
          {
            vat_category_code: 'O',
            vat_rate: 0,
            taxable_amount: 1000,
            tax_amount: 0,
          },
        ],
        subtotal: 1000,
        tax_exclusive_amount: 1000,
        tax_amount: 0,
        tax_inclusive_amount: 1000,
        shipping_fee: 0,
        total: 1000,
      })
    );

    expect(xml).toContain('Akin &amp; Sons &lt;Buyer&gt; &quot;Prime&quot;');
    expect(xml).toContain(
      'Phone &amp; Case &lt;Bundle&gt; &apos;Limited&apos;'
    );
  });

  it('throws before claiming compliance when required invoice data is missing', () => {
    expect(() =>
      generatePeppolInvoiceXml(createInvoiceData({ items: [] }))
    ).toThrow('at least one invoice line is required');
  });

  it('uses non-PII references and default country fallbacks', () => {
    const xml = generatePeppolInvoiceXml(
      createInvoiceData({
        buyer_reference: undefined,
        customer: {
          email: 'akin@example.com',
          id: 'customer-1',
          name: 'Akinola Ogunniran',
          address: {
            country: undefined,
          },
        },
        due_date: undefined,
        order_id: 'order-1',
        payment_terms: undefined,
      })
    );

    expect(xml).toContain('<cbc:BuyerReference>order-1</cbc:BuyerReference>');
    expect(xml).not.toContain('akin@example.com</cbc:BuyerReference>');
    expect(xml).not.toContain('Akinola Ogunniran</cbc:BuyerReference>');
    expect(xml).toContain('<cbc:DueDate>2026-06-13</cbc:DueDate>');
    expect(xml).toContain(
      '<cbc:IdentificationCode>NG</cbc:IdentificationCode>'
    );
  });

  it('falls back to a stable default buyer reference without customer identifiers', () => {
    const xml = generatePeppolInvoiceXml(
      createInvoiceData({
        buyer_reference: undefined,
        customer: {
          email: 'akin@example.com',
          name: 'Akinola Ogunniran',
        },
        due_date: undefined,
        order_id: undefined,
        payment_terms: undefined,
      })
    );

    expect(xml).toContain(
      '<cbc:BuyerReference>BACI-CUSTOMER</cbc:BuyerReference>'
    );
    expect(xml).not.toContain('akin@example.com</cbc:BuyerReference>');
    expect(xml).not.toContain('Akinola Ogunniran</cbc:BuyerReference>');
  });

  it('returns an XML blob', () => {
    const blob = generatePeppolInvoiceXmlBlob(createInvoiceData());

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/xml');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('exports the branded invoice compliance note', () => {
    expect(PEPPOL_BIS_BILLING_COMPLIANCE_NOTE).toContain(
      'Peppol BIS Billing 3.0'
    );
  });
});
