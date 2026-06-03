import type { InvoiceData, InvoiceLineItem } from '@/lib/invoice-generator';
import { escapeXml } from '@/lib/xml-utils';

const PEPPOL_CUSTOMIZATION_ID =
  'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0';
const PEPPOL_PROFILE_ID = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0';
const DEFAULT_BUYER_REFERENCE = 'BACI-CUSTOMER';

export const PEPPOL_BIS_BILLING_COMPLIANCE_NOTE =
  'This invoice complies with Peppol BIS Billing 3.0 through a generated UBL XML invoice artifact created from this order.';

function isValidDate(value: Date) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function formatDate(value: Date) {
  if (!isValidDate(value)) {
    throw new Error('Invoice issue date is invalid');
  }

  return value.toISOString().slice(0, 10);
}

function formatAmount(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error('Invoice amount is invalid');
  }

  return value.toFixed(2);
}

function normalizeCountry(value: string | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized && normalized.length === 2 ? normalized : 'NG';
}

function normalizeVatCategory(item: InvoiceLineItem) {
  return item.vat_category_code?.trim() || 'O';
}

function normalizeVatRate(item: InvoiceLineItem) {
  return typeof item.vat_rate === 'number' && Number.isFinite(item.vat_rate)
    ? item.vat_rate
    : 0;
}

function element(name: string, value: string | number, attributes = '') {
  return `<${name}${attributes}>${escapeXml(String(value))}</${name}>`;
}

function optionalElement(
  name: string,
  value: string | number | null | undefined,
  attributes = ''
) {
  if (value == null || String(value).trim().length === 0) {
    return '';
  }

  return element(name, value, attributes);
}

function partyAddress(address: InvoiceData['merchant']['registered_address']) {
  const country = normalizeCountry(address?.country);

  return `<cac:PostalAddress>
${optionalElement('cbc:StreetName', address?.street)}
${optionalElement('cbc:CityName', address?.city)}
${optionalElement('cbc:PostalZone', address?.postal_code)}
${optionalElement('cbc:CountrySubentity', address?.state)}
<cac:Country>${element('cbc:IdentificationCode', country)}</cac:Country>
</cac:PostalAddress>`;
}

function supplierParty(data: InvoiceData) {
  const merchant = data.merchant;
  const registrationName =
    merchant.legal_entity_name || merchant.business_name || 'Seller';

  return `<cac:AccountingSupplierParty>
<cac:Party>
<cac:PartyName>${element('cbc:Name', registrationName)}</cac:PartyName>
${partyAddress(merchant.registered_address)}
${
  merchant.tax_identification_number
    ? `<cac:PartyTaxScheme>
${element('cbc:CompanyID', merchant.tax_identification_number)}
<cac:TaxScheme>${element('cbc:ID', 'VAT')}</cac:TaxScheme>
</cac:PartyTaxScheme>`
    : ''
}
<cac:PartyLegalEntity>
${element('cbc:RegistrationName', registrationName)}
${optionalElement('cbc:CompanyID', merchant.cac_rc_number)}
</cac:PartyLegalEntity>
<cac:Contact>
${optionalElement('cbc:Telephone', merchant.support_phone)}
${optionalElement('cbc:ElectronicMail', merchant.support_email)}
</cac:Contact>
</cac:Party>
</cac:AccountingSupplierParty>`;
}

function customerParty(data: InvoiceData) {
  const customer = data.customer;

  return `<cac:AccountingCustomerParty>
<cac:Party>
<cac:PartyName>${element('cbc:Name', customer.name)}</cac:PartyName>
${partyAddress(customer.address)}
${
  customer.tax_id
    ? `<cac:PartyTaxScheme>
${element('cbc:CompanyID', customer.tax_id)}
<cac:TaxScheme>${element('cbc:ID', 'VAT')}</cac:TaxScheme>
</cac:PartyTaxScheme>`
    : ''
}
<cac:PartyLegalEntity>${element('cbc:RegistrationName', customer.name)}</cac:PartyLegalEntity>
<cac:Contact>
${optionalElement('cbc:Telephone', customer.phone)}
${optionalElement('cbc:ElectronicMail', customer.email)}
</cac:Contact>
</cac:Party>
</cac:AccountingCustomerParty>`;
}

function taxTotal(data: InvoiceData) {
  const taxSubtotalXml = data.tax_subtotals
    .map(
      (subtotal) => `<cac:TaxSubtotal>
${element('cbc:TaxableAmount', formatAmount(subtotal.taxable_amount), ` currencyID="${escapeXml(data.currency)}"`)}
${element('cbc:TaxAmount', formatAmount(subtotal.tax_amount), ` currencyID="${escapeXml(data.currency)}"`)}
<cac:TaxCategory>
${element('cbc:ID', subtotal.vat_category_code)}
${element('cbc:Percent', formatAmount(subtotal.vat_rate))}
${optionalElement('cbc:TaxExemptionReason', subtotal.exemption_reason)}
<cac:TaxScheme>${element('cbc:ID', 'VAT')}</cac:TaxScheme>
</cac:TaxCategory>
</cac:TaxSubtotal>`
    )
    .join('\n');

  return `<cac:TaxTotal>
${element('cbc:TaxAmount', formatAmount(data.tax_amount), ` currencyID="${escapeXml(data.currency)}"`)}
${taxSubtotalXml}
</cac:TaxTotal>`;
}

function legalMonetaryTotal(data: InvoiceData) {
  return `<cac:LegalMonetaryTotal>
${element('cbc:LineExtensionAmount', formatAmount(data.subtotal), ` currencyID="${escapeXml(data.currency)}"`)}
${element('cbc:TaxExclusiveAmount', formatAmount(data.tax_exclusive_amount), ` currencyID="${escapeXml(data.currency)}"`)}
${element('cbc:TaxInclusiveAmount', formatAmount(data.tax_inclusive_amount), ` currencyID="${escapeXml(data.currency)}"`)}
${data.discount_amount > 0 ? element('cbc:AllowanceTotalAmount', formatAmount(data.discount_amount), ` currencyID="${escapeXml(data.currency)}"`) : ''}
${data.shipping_fee > 0 ? element('cbc:ChargeTotalAmount', formatAmount(data.shipping_fee), ` currencyID="${escapeXml(data.currency)}"`) : ''}
${element('cbc:PayableAmount', formatAmount(data.total), ` currencyID="${escapeXml(data.currency)}"`)}
</cac:LegalMonetaryTotal>`;
}

function invoiceLine(data: InvoiceData, item: InvoiceLineItem) {
  const vatCategory = normalizeVatCategory(item);
  const vatRate = normalizeVatRate(item);

  return `<cac:InvoiceLine>
${element('cbc:ID', item.line_id)}
${element('cbc:InvoicedQuantity', formatAmount(item.quantity), ` unitCode="${escapeXml(item.unit_code || 'EA')}"`)}
${element('cbc:LineExtensionAmount', formatAmount(item.line_extension_amount), ` currencyID="${escapeXml(data.currency)}"`)}
<cac:Item>
${optionalElement('cbc:Description', item.description)}
${element('cbc:Name', item.name)}
${item.sellers_item_id || item.product_id ? `<cac:SellersItemIdentification>${element('cbc:ID', item.sellers_item_id || item.product_id || '')}</cac:SellersItemIdentification>` : ''}
<cac:ClassifiedTaxCategory>
${element('cbc:ID', vatCategory)}
${element('cbc:Percent', formatAmount(vatRate))}
<cac:TaxScheme>${element('cbc:ID', 'VAT')}</cac:TaxScheme>
</cac:ClassifiedTaxCategory>
</cac:Item>
<cac:Price>${element('cbc:PriceAmount', formatAmount(item.price), ` currencyID="${escapeXml(data.currency)}"`)}</cac:Price>
</cac:InvoiceLine>`;
}

function validatePeppolInvoiceData(data: InvoiceData) {
  const errors: string[] = [];

  if (!data.invoice_number.trim()) errors.push('invoice_number is required');
  if (!isValidDate(data.issue_date)) errors.push('issue_date is required');
  if (!data.invoice_type_code.trim())
    errors.push('invoice_type_code is required');
  if (!/^[A-Z]{3}$/.test(data.currency))
    errors.push('currency must be an ISO 4217 code');
  if (!data.merchant.business_name.trim())
    errors.push('merchant.business_name is required');
  if (!data.customer.name.trim()) errors.push('customer.name is required');
  if (data.items.length === 0)
    errors.push('at least one invoice line is required');
  if (data.tax_subtotals.length === 0)
    errors.push('at least one tax subtotal is required');

  for (const item of data.items) {
    if (!item.name.trim())
      errors.push(`invoice line ${item.line_id} name is required`);
    if (item.quantity <= 0)
      errors.push(`invoice line ${item.line_id} quantity must be positive`);
    if (item.line_extension_amount < 0) {
      errors.push(`invoice line ${item.line_id} amount must be non-negative`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Cannot generate Peppol UBL invoice: ${errors.join('; ')}`);
  }
}

export function generatePeppolInvoiceXml(data: InvoiceData) {
  validatePeppolInvoiceData(data);

  const buyerReference =
    data.buyer_reference ||
    data.purchase_order_reference ||
    data.customer.email ||
    data.customer.name ||
    DEFAULT_BUYER_REFERENCE;
  const dueDate =
    data.due_date ||
    (data.payment_terms
      ? null
      : new Date(data.issue_date.getTime() + 14 * 24 * 60 * 60 * 1000));

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
${element('cbc:CustomizationID', PEPPOL_CUSTOMIZATION_ID)}
${element('cbc:ProfileID', PEPPOL_PROFILE_ID)}
${element('cbc:ID', data.invoice_number)}
${element('cbc:IssueDate', formatDate(data.issue_date))}
${dueDate ? element('cbc:DueDate', formatDate(dueDate)) : ''}
${element('cbc:InvoiceTypeCode', data.invoice_type_code)}
${optionalElement('cbc:Note', data.notes)}
${data.tax_point_date ? element('cbc:TaxPointDate', formatDate(data.tax_point_date)) : ''}
${element('cbc:DocumentCurrencyCode', data.currency)}
${element('cbc:BuyerReference', buyerReference)}
${data.purchase_order_reference ? `<cac:OrderReference>${element('cbc:ID', data.purchase_order_reference)}</cac:OrderReference>` : ''}
${supplierParty(data)}
${customerParty(data)}
<cac:PaymentMeans>${element('cbc:PaymentMeansCode', '30')}</cac:PaymentMeans>
${data.payment_terms ? `<cac:PaymentTerms>${element('cbc:Note', data.payment_terms)}</cac:PaymentTerms>` : ''}
${taxTotal(data)}
${legalMonetaryTotal(data)}
${data.items.map((item) => invoiceLine(data, item)).join('\n')}
</Invoice>`;
}

export function generatePeppolInvoiceXmlBlob(data: InvoiceData) {
  return new Blob([generatePeppolInvoiceXml(data)], {
    type: 'application/xml',
  });
}
