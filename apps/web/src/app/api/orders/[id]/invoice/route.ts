import {
  appendReceiptFulfillmentDescription,
  isDeviceReceiptItemName,
  normalizeReceiptFulfillmentDetails,
  type ReceiptMerchant,
  type ReceiptOrder,
} from '@baci/shared';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type {
  InvoiceData,
  InvoiceLineItem,
  TaxSubtotal,
} from '@/lib/invoice-generator';
import { ORDER_COLUMNS } from '@/lib/order-queries';
import {
  generatePeppolInvoiceXml,
  PEPPOL_BIS_BILLING_COMPLIANCE_NOTE,
} from '@/lib/peppol-ubl-invoice';
import {
  generateReceiptBlob,
  resolveReceiptLogoDataUri,
} from '@/lib/receipt-pdf-generator';
import { createClient } from '@/lib/supabase/server';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

interface OrderItem {
  id: string;
  line_id: number | null;
  name: string;
  item_description: string | null;
  quantity: number;
  price: number;
  unit_code: string | null;
  line_extension_amount: number | null;
  vat_category_code: string | null;
  vat_rate: number | null;
  vat_amount: number | null;
  sellers_item_id: string | null;
  product_id: string | null;
}

interface TaxSubtotalRow {
  vat_category_code: string;
  vat_rate: number;
  taxable_amount: number;
  tax_amount: number;
  exemption_reason: string | null;
}

interface PaymentAccountRow {
  account_number: string;
  bank_name: string | null;
  account_name: string | null;
}

interface RegisteredAddress {
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

interface ShippingAddress {
  address?: string;
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
}

/**
 * GET /api/orders/[id]/invoice
 * Generate and download a Peppol BIS 3.0 compliant invoice PDF
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid order ID', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const orderId = parsed.data.id;

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch order with all related data, scoped to authenticated user
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        `
        ${ORDER_COLUMNS}, invoice_type_code, invoice_issue_date, tax_point_date, payment_due_date, buyer_reference, purchase_order_reference, tax_exclusive_amount, tax_inclusive_amount, invoice_note, firs_irn, firs_csid, firs_qr_code, payment_terms, is_credit_order,
        merchants!inner (
          id,
          user_id,
          business_name,
          legal_entity_name,
          tax_identification_number,
          cac_rc_number,
          vat_registration_status,
          vat_rate,
          registered_address,
          email,
          phone,
          business_address,
          support_email,
          support_phone,
          logo_url,
          brand_colors,
          bank_code,
          bank_account_number,
          bank_name,
          bank_account_name,
          social_media,
          pages
        )
      `
      )
      .eq('id', orderId)
      .eq('merchants.user_id', user.id)
      .single();

    if (orderError || !order) {
      console.error('Error fetching order:', orderError);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    type MerchantData = {
      id: string;
      user_id: string;
      business_name: string;
      legal_entity_name: string | null;
      tax_identification_number: string | null;
      cac_rc_number: string | null;
      vat_registration_status: string | null;
      vat_rate: number | null;
      registered_address: RegisteredAddress | null;
      email: string | null;
      phone: string | null;
      business_address: string | null;
      support_email: string | null;
      support_phone: string | null;
      logo_url: string | null;
      brand_colors: ReceiptMerchant['brand_colors'] | null;
      bank_code: string | null;
      bank_account_number: string | null;
      bank_name: string | null;
      bank_account_name: string | null;
      social_media: ReceiptMerchant['social_media'] | null;
      pages: ReceiptMerchant['pages'] | null;
    };

    // Normalize: Supabase may return an object or array depending on join
    const rawMerchant = order.merchants;
    const merchantData = Array.isArray(rawMerchant)
      ? rawMerchant[0]
      : rawMerchant;
    if (!merchantData || typeof merchantData !== 'object') {
      console.error('Unexpected merchant data shape:', {
        type: typeof rawMerchant,
        isArray: Array.isArray(rawMerchant),
        isNull: rawMerchant === null,
      });
      return NextResponse.json(
        { error: 'Invalid merchant data' },
        { status: 500 }
      );
    }

    const md = merchantData as Record<string, unknown>;
    if (
      typeof md.id !== 'string' ||
      typeof md.user_id !== 'string' ||
      typeof md.business_name !== 'string'
    ) {
      console.error('Merchant data missing required fields:', {
        hasId: typeof md.id === 'string',
        hasUserId: typeof md.user_id === 'string',
        hasBusinessName: typeof md.business_name === 'string',
      });
      return NextResponse.json(
        { error: 'Invalid merchant data' },
        { status: 500 }
      );
    }

    const merchant = md as MerchantData;

    if (merchant.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch order items
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select(
        'id, line_id, name, item_description, quantity, price, unit_code, line_extension_amount, vat_category_code, vat_rate, vat_amount, sellers_item_id, product_id'
      )
      .eq('order_id', orderId)
      .order('line_id', { ascending: true });

    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
      return NextResponse.json(
        { error: 'Failed to fetch order items' },
        { status: 500 }
      );
    }

    // Fetch tax subtotals if VAT registered
    let taxSubtotals: TaxSubtotalRow[] = [];
    if (merchant.vat_registration_status === 'registered') {
      const { data: subtotals, error: taxError } = await supabase
        .from('order_tax_subtotals')
        .select(
          'vat_category_code, vat_rate, taxable_amount, tax_amount, exemption_reason'
        )
        .eq('order_id', orderId);

      if (taxError) {
        console.error(
          'Error fetching order_tax_subtotals for order:',
          orderId,
          taxError
        );
        return NextResponse.json(
          { error: 'Failed to fetch tax data for invoice' },
          { status: 500 }
        );
      }

      taxSubtotals = subtotals || [];
    }

    const typedOrderItems = orderItems as OrderItem[];
    const fulfillment = normalizeReceiptFulfillmentDetails(
      order.fulfillment_details
    );
    const hasDeviceItem = typedOrderItems.some((item) =>
      isDeviceReceiptItemName(item.name || '')
    );

    // Build invoice line items
    const items: InvoiceLineItem[] = typedOrderItems.map((item, index) => {
      const desc = appendReceiptFulfillmentDescription({
        description: item.item_description || undefined,
        fulfillment,
        hasDeviceItem,
        index,
        itemName: item.name || '',
      });

      return {
        line_id: item.line_id || index + 1,
        product_id: item.product_id || undefined,
        name: item.name || '',
        description: desc,
        quantity: item.quantity,
        unit_code: item.unit_code || 'EA',
        price: Number(item.price),
        line_extension_amount:
          item.line_extension_amount || item.quantity * Number(item.price),
        vat_category_code: item.vat_category_code || 'S',
        vat_rate: item.vat_rate || merchant.vat_rate || 7.5,
        vat_amount: item.vat_amount || 0,
        sellers_item_id: item.sellers_item_id || undefined,
      };
    });

    // Build tax subtotals for invoice
    const invoiceTaxSubtotals: TaxSubtotal[] = taxSubtotals.map((st) => ({
      vat_category_code: st.vat_category_code,
      vat_rate: st.vat_rate,
      taxable_amount: Number(st.taxable_amount),
      tax_amount: Number(st.tax_amount),
      exemption_reason: st.exemption_reason || undefined,
    }));

    // If no tax subtotals exist, create a default one
    if (
      invoiceTaxSubtotals.length === 0 &&
      merchant.vat_registration_status === 'registered'
    ) {
      const taxableAmount = items.reduce(
        (sum, item) => sum + item.line_extension_amount,
        0
      );
      const taxAmount = items.reduce(
        (sum, item) => sum + (item.vat_amount ?? 0),
        0
      );
      invoiceTaxSubtotals.push({
        vat_category_code: 'S',
        vat_rate: merchant.vat_rate || 7.5,
        taxable_amount: taxableAmount,
        tax_amount: taxAmount,
      });
    }

    const { data: paymentAccounts, error: paymentAccountError } = await supabase
      .from('order_payment_accounts')
      .select('account_number, bank_name, account_name')
      .eq('order_id', orderId)
      .limit(1);

    if (paymentAccountError) {
      console.error(
        'Error fetching order_payment_accounts for invoice:',
        orderId,
        paymentAccountError
      );
    }

    const paymentAccount = (
      Array.isArray(paymentAccounts) ? paymentAccounts[0] : null
    ) as PaymentAccountRow | null;

    // Parse shipping address
    const shippingAddr = order.shipping_address as ShippingAddress | null;
    const customerAddress = shippingAddr
      ? {
          street: shippingAddr.address || shippingAddr.street,
          city: shippingAddr.city,
          state: shippingAddr.state,
          postal_code: shippingAddr.postal_code,
          country: shippingAddr.country || 'NG',
        }
      : undefined;
    const amountPaid = Number(order.amount_paid || 0);

    // Build the invoice data structure
    const invoiceData: InvoiceData = {
      // Document identifiers
      invoice_number:
        order.order_number || `INV-${order.id.slice(0, 8).toUpperCase()}`,
      invoice_type_code: order.invoice_type_code || '380',
      issue_date: order.invoice_issue_date
        ? new Date(order.invoice_issue_date)
        : new Date(order.created_at),
      tax_point_date: order.tax_point_date
        ? new Date(order.tax_point_date)
        : undefined,
      due_date: order.payment_due_date
        ? new Date(order.payment_due_date)
        : undefined,

      // Currency
      currency: order.currency || 'NGN',

      // References
      buyer_reference: order.buyer_reference || undefined,
      purchase_order_reference: order.purchase_order_reference || undefined,

      // Merchant (Seller)
      merchant: {
        business_name: merchant.business_name,
        legal_entity_name: merchant.legal_entity_name || undefined,
        tax_identification_number:
          merchant.tax_identification_number || undefined,
        cac_rc_number: merchant.cac_rc_number || undefined,
        vat_registration_status:
          merchant.vat_registration_status || 'not_registered',
        vat_rate: merchant.vat_rate || 7.5,
        registered_address: merchant.registered_address || undefined,
        support_email: merchant.support_email || undefined,
        support_phone: merchant.support_phone || undefined,
        logo_url: merchant.logo_url || undefined,
      },

      // Customer (Buyer)
      customer: {
        name: order.customer_name || 'Customer',
        email: order.customer_email || undefined,
        phone: order.customer_phone || undefined,
        address: customerAddress,
      },

      // Line items
      items,

      // Tax breakdown
      tax_subtotals: invoiceTaxSubtotals,

      // Totals
      subtotal: Number(order.subtotal || 0),
      tax_exclusive_amount: Number(
        order.tax_exclusive_amount || order.subtotal || 0
      ),
      tax_amount: Number(order.tax_amount || 0),
      tax_inclusive_amount: Number(
        order.tax_inclusive_amount ||
          (order.subtotal || 0) + (order.tax_amount || 0)
      ),
      shipping_fee: Number(order.shipping_fee || 0),
      discount_amount: Number(order.discount_amount || 0),
      total: Number(order.total || 0),
      amount_paid: amountPaid,

      // Additional info
      notes: order.invoice_note || order.notes || undefined,
      payment_terms: order.payment_terms || undefined,
      payment_account: paymentAccount
        ? {
            account_number: paymentAccount.account_number,
            account_name: paymentAccount.account_name || undefined,
            bank_name: paymentAccount.bank_name || undefined,
          }
        : merchant.bank_account_number
          ? {
              account_number: merchant.bank_account_number,
              account_name:
                merchant.bank_account_name ||
                merchant.legal_entity_name ||
                merchant.business_name,
              bank_name: merchant.bank_name || undefined,
            }
          : undefined,

      // FIRS specific
      firs_irn: order.firs_irn || undefined,
      firs_csid: order.firs_csid || undefined,
      firs_qr_code: order.firs_qr_code || undefined,
    };

    const receiptOrder: ReceiptOrder = {
      order_number: invoiceData.invoice_number,
      created_at: String(order.created_at),
      currency: invoiceData.currency,
      total: invoiceData.total,
      subtotal: invoiceData.subtotal,
      shipping_fee: invoiceData.shipping_fee,
      tax_amount: invoiceData.tax_amount,
      discount_amount: invoiceData.discount_amount,
      amount_paid: amountPaid,
      balance: Math.max(invoiceData.total - amountPaid, 0),
      payment_status: order.payment_status || 'unpaid',
      payment_method: order.payment_method || null,
      is_credit_order: Boolean(order.is_credit_order),
      customer_name: invoiceData.customer.name,
      customer_email: invoiceData.customer.email || '',
      customer_phone: invoiceData.customer.phone || null,
      shipping_address: shippingAddr
        ? {
            address_line1: shippingAddr.address || shippingAddr.street,
            city: shippingAddr.city,
            state: shippingAddr.state,
            postal_code: shippingAddr.postal_code,
            country: shippingAddr.country || 'NG',
          }
        : null,
      virtual_account: paymentAccount
        ? {
            account_number: paymentAccount.account_number,
            bank_name: paymentAccount.bank_name || '',
            account_name: paymentAccount.account_name || '',
          }
        : null,
      fulfillment_details: fulfillment,
      items: items.map((item) => ({
        product_name: item.name || 'Item',
        description: item.description,
        quantity: item.quantity,
        price: Number(item.price),
      })),
      transactions: [],
    };
    const receiptMerchant: ReceiptMerchant = {
      business_name: merchant.business_name,
      logo_url: merchant.logo_url,
      email: merchant.email || '',
      phone: merchant.phone,
      support_email: merchant.support_email,
      support_phone: merchant.support_phone,
      business_address: merchant.business_address,
      cac_rc_number: merchant.cac_rc_number,
      tax_identification_number: merchant.tax_identification_number,
      legal_entity_name: merchant.legal_entity_name,
      brand_colors: merchant.brand_colors || undefined,
      vat_registration_status: merchant.vat_registration_status,
      vat_rate: merchant.vat_rate,
      bank_code: merchant.bank_code,
      bank_account_number: merchant.bank_account_number,
      bank_name: merchant.bank_name,
      bank_account_name: merchant.bank_account_name,
      social_media: merchant.social_media,
      pages: merchant.pages,
    };
    let complianceNote: string | undefined;

    try {
      generatePeppolInvoiceXml(invoiceData);
      complianceNote = PEPPOL_BIS_BILLING_COMPLIANCE_NOTE;
    } catch (peppolError) {
      console.error('Failed to generate Peppol UBL invoice XML:', peppolError);
    }

    // Generate the branded PDF
    const logoDataUri = await resolveReceiptLogoDataUri(receiptMerchant);
    const pdfBlob = generateReceiptBlob(receiptOrder, receiptMerchant, {
      complianceNote,
      documentDate: invoiceData.issue_date,
      documentKind: 'invoice',
      dueDate: invoiceData.due_date,
      firsCsid: invoiceData.firs_csid,
      firsIrn: invoiceData.firs_irn,
      logoDataUri,
      paymentTerms: invoiceData.payment_terms,
    });

    // Return the PDF as a response
    const pdfArrayBuffer = await pdfBlob.arrayBuffer();

    return new NextResponse(pdfArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoiceData.invoice_number}.pdf"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice' },
      { status: 500 }
    );
  }
}
